/**
 * Shared marketing copy that crosses the server/client boundary (e.g. FAQ used
 * both for FAQPage JSON-LD in a server component and rendered in a client one).
 * Kept in a plain module — never a 'use client' file — so server components get
 * the real values, not client-reference proxies.
 */
export const FAQ_ITEMS = [
  { question: 'What is an AI employee?', answer: 'An AI employee is a configured worker with a role, goal, tools, memory, and guardrails. You hire one from the marketplace and it starts handling its work immediately — with full visibility and human approval on sensitive actions.' },
  { question: 'Do I need to write code or prompts?', answer: 'No. Hire a ready-made role like HR Manager or Support Lead in one click. Advanced configuration is available behind progressive disclosure when you want it.' },
  { question: 'How do employees work together?', answer: 'A Chief of Staff routes each request to the right employee, and employees hand off work to one another. Everything is visible in one live company chat timeline.' },
  { question: 'Can I keep humans in control?', answer: 'Yes. Every employee has activation, approval-mode, plan-mode, and spend controls. Risky actions pause for approval — in-app or via a signed email link — and every run is fully traceable.' },
  { question: 'Do they learn?', answer: 'Yes. When you correct a routing decision, that correction is stored as durable memory; the same request then routes itself next time — no repeat instruction needed.' },
  { question: 'Can I self-host?', answer: 'Yes. Bitecodes is open-core (Apache 2.0) and runs on a single AI provider — one OpenRouter key or a local Ollama install. No ten-provider juggling.' },
];
