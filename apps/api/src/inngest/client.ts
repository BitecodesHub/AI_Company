/**
 * Inngest client — shared singleton for both emitting events and defining functions.
 * All Inngest event names are slash-namespaced per BUILD_GUIDE §6.
 */
import { Inngest } from 'inngest';

export const inngest = new Inngest({
  id: 'bitecodes',
  // Use the Inngest Cloud signing key in production; dev server in development
  signingKey: process.env['INNGEST_SIGNING_KEY'],
  eventKey: process.env['INNGEST_EVENT_KEY'] ?? 'bitecodes-dev',
});
