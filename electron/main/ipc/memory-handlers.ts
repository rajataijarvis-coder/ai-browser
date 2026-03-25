/**
 * INPUT: IPC events from renderer process
 * OUTPUT: Memory management responses via IPC
 * POSITION: Bridge between Settings UI and MemoryService
 */

import { ipcMain } from "electron";
import { windowContextManager } from "../services/window-context-manager";
import { successResponse, errorResponse } from "../utils/ipc-response";

export function registerMemoryHandlers(): void {
  const getService = () => {
    const contexts = windowContextManager.getAllContexts();
    const mainCtx = contexts.find((c) => c.windowType === "main");
    return mainCtx?.ekoService?.getMemoryService();
  };

  ipcMain.handle("memory:list", async (_e, filter?: { keyword?: string; source?: string }) => {
    try {
      const service = getService();
      if (!service) return errorResponse("MemoryService not available");
      return successResponse(service.getMemories(filter));
    } catch (error) {
      return errorResponse(error);
    }
  });

  ipcMain.handle("memory:search", async (_e, query: string, maxResults?: number) => {
    try {
      const service = getService();
      if (!service) return errorResponse("MemoryService not available");
      const results = service.searchMemories(query, maxResults);
      return successResponse(results.map(r => ({ ...r.entry, score: r.score })));
    } catch (error) {
      return errorResponse(error);
    }
  });

  ipcMain.handle("memory:add", async (_e, content: string) => {
    try {
      const service = getService();
      if (!service) return errorResponse("MemoryService not available");
      const entry = service.addManual(content);
      return successResponse(entry);
    } catch (error) {
      return errorResponse(error);
    }
  });

  ipcMain.handle("memory:delete", async (_e, id: string) => {
    try {
      const service = getService();
      if (!service) return errorResponse("MemoryService not available");
      service.deleteMemory(id);
      return successResponse(true);
    } catch (error) {
      return errorResponse(error);
    }
  });

  ipcMain.handle("memory:clear", async () => {
    try {
      const service = getService();
      if (!service) return errorResponse("MemoryService not available");
      service.clearAll();
      return successResponse(true);
    } catch (error) {
      return errorResponse(error);
    }
  });

  ipcMain.handle("memory:stats", async () => {
    try {
      const service = getService();
      if (!service) return errorResponse("MemoryService not available");
      return successResponse(service.getStats());
    } catch (error) {
      return errorResponse(error);
    }
  });
}
