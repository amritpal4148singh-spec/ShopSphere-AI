/** How long the "typing" indicator shows at least, so the answer reads as a reply rather than a flash. Zero under test. */
export const MIN_THINKING_MS = process.env.NODE_ENV === "test" ? 0 : 350;

export const ERROR_TEXT = "Sorry, I couldn't load the products just now. Check your connection and try again. Your conversation is still here.";

export const PANEL_ID = "assistant-panel";
