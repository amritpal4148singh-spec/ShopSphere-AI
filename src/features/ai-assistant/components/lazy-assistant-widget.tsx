"use client";

import dynamic from "next/dynamic";

/**
 * The assistant (panel, chat history, rule engine wiring) is loaded after the page is interactive, so it stays out of the
 * first bundle of every route (PRD 12: dynamic imports for the assistant panel). It renders nothing while loading; the
 * launcher itself enters after a delay anyway.
 */
export const LazyAssistantWidget = dynamic(() => import("./assistant-widget").then((module) => module.AssistantWidget), { ssr: false });
