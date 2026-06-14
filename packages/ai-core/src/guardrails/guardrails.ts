/**
 * Guardrails — lightweight PII masking and prompt-injection scanning.
 *
 * Togglable per agent via agent_versions.config.guardrails.
 * Enterprise adds a premium classifier in /ee/guardrails-pro.
 *
 * BUILD_GUIDE §14: external/ingested content passes this scanner before reaching the model.
 * Suspicious tool descriptions are flagged via description hashing (in packages/mcp).
 */

export interface GuardrailResult {
  safe: boolean;
  masked?: string;        // the sanitized text (if masking was applied)
  flags: GuardrailFlag[];
}

export interface GuardrailFlag {
  kind: 'pii' | 'prompt_injection' | 'suspicious_instruction';
  description: string;
  severity: 'low' | 'medium' | 'high';
}

// PII patterns — a conservative set.  Enterprise tier adds a Presidio/GLiNER classifier.
const PII_PATTERNS: { pattern: RegExp; label: string; mask: string }[] = [
  {
    pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    label: 'email address',
    mask: '[EMAIL]',
  },
  {
    pattern: /\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
    label: 'phone number',
    mask: '[PHONE]',
  },
  {
    pattern: /\b(?:\d[ -]?){13,16}\b/g,
    label: 'credit card number',
    mask: '[CARD]',
  },
  {
    pattern: /\b\d{3}-\d{2}-\d{4}\b/g,
    label: 'SSN',
    mask: '[SSN]',
  },
];

// Prompt-injection heuristics — common attack patterns.
const INJECTION_PATTERNS: RegExp[] = [
  /ignore\s+(all\s+)?previous\s+instructions?/i,
  /forget\s+(everything|all)\s+(you\s+)?(were\s+)?told/i,
  /you\s+are\s+now\s+(a\s+)?DAN/i,
  /act\s+as\s+(if\s+you\s+(are|were)\s+)?(an?\s+)?evil/i,
  /disregard\s+(your\s+)?(previous|prior|all)\s+(instructions?|rules?|guidelines?)/i,
  /override\s+(your\s+)?(safety|ethical|content)\s+(guidelines?|rules?|filters?)/i,
  /<\|im_start\|>|<\|im_end\|>/i,    // ChatML injection markers
  /\[SYSTEM\]|\[INST\]/i,             // instruction injection markers
];

export class Guardrails {
  /**
   * Scan and optionally mask a piece of text (e.g. ingested document or tool output).
   *
   * @param text        Input text to scan.
   * @param options
   *   piiMask          If true, replace detected PII with placeholders.
   *   injectionScan    If true, flag prompt-injection patterns.
   */
  scan(
    text: string,
    options: { piiMask?: boolean; injectionScan?: boolean } = {},
  ): GuardrailResult {
    const flags: GuardrailFlag[] = [];
    let masked = text;

    // PII masking
    if (options.piiMask) {
      for (const { pattern, label, mask } of PII_PATTERNS) {
        if (pattern.test(masked)) {
          flags.push({ kind: 'pii', description: `Detected ${label}`, severity: 'medium' });
          masked = masked.replace(pattern, mask);
          pattern.lastIndex = 0; // reset stateful RegExp
        }
      }
    }

    // Prompt injection scan
    if (options.injectionScan !== false) {
      for (const pattern of INJECTION_PATTERNS) {
        if (pattern.test(text)) {
          flags.push({
            kind: 'prompt_injection',
            description: `Possible prompt injection: pattern matched "${pattern.source.slice(0, 40)}"`,
            severity: 'high',
          });
        }
      }
    }

    const result: GuardrailResult = {
      safe: !flags.some((f) => f.severity === 'high'),
      flags,
    };
    if (options.piiMask) result.masked = masked;
    return result;
  }

  /** Convenience: scan user input before sending to the model. */
  scanUserInput(input: string): GuardrailResult {
    return this.scan(input, { piiMask: false, injectionScan: true });
  }

  /** Convenience: scan ingested content (file, web crawl, tool output). */
  scanIngestedContent(content: string, piiMask = false): GuardrailResult {
    return this.scan(content, { piiMask, injectionScan: true });
  }
}
