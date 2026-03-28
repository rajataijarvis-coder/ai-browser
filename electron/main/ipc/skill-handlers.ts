/**
 * INPUT: IPC events from renderer process
 * OUTPUT: Skill management responses via IPC
 * POSITION: Bridge between Settings UI and SkillService
 */

import { ipcMain, dialog } from "electron";
import { windowContextManager } from "../services/window-context-manager";
import { successResponse, errorResponse } from "../utils/ipc-response";

export function registerSkillHandlers(): void {
  const getService = () => {
    const contexts = windowContextManager.getAllContexts();
    const mainCtx = contexts.find((c) => c.windowType === "main");
    return mainCtx?.ekoService?.getSkillService();
  };

  ipcMain.handle("skills:list", async () => {
    try {
      const service = getService();
      if (!service) return errorResponse("SkillService not available");
      return successResponse(service.getAllMetadata());
    } catch (error) {
      return errorResponse(error);
    }
  });

  ipcMain.handle("skills:get-content", async (_e, name: string) => {
    try {
      const service = getService();
      if (!service) return errorResponse("SkillService not available");
      const content = await service.loadSkill(name);
      return successResponse(content);
    } catch (error) {
      return errorResponse(error);
    }
  });

  ipcMain.handle("skills:import-zip", async () => {
    try {
      const service = getService();
      if (!service) return errorResponse("SkillService not available");

      const result = await dialog.showOpenDialog({
        filters: [{ name: "Skill Package", extensions: ["zip"] }],
        properties: ["openFile"],
      });
      if (result.canceled || !result.filePaths.length) {
        return errorResponse("Cancelled");
      }

      const skill = await service.importFromZip(result.filePaths[0]);
      return successResponse(skill);
    } catch (error) {
      return errorResponse(error);
    }
  });

  ipcMain.handle("skills:import-folder", async () => {
    try {
      const service = getService();
      if (!service) return errorResponse("SkillService not available");

      const result = await dialog.showOpenDialog({
        properties: ["openDirectory"],
      });
      if (result.canceled || !result.filePaths.length) {
        return errorResponse("Cancelled");
      }

      const skill = await service.importFromFolder(result.filePaths[0]);
      return successResponse(skill);
    } catch (error) {
      return errorResponse(error);
    }
  });

  ipcMain.handle("skills:delete", async (_e, name: string) => {
    try {
      const service = getService();
      if (!service) return errorResponse("SkillService not available");
      await service.deleteSkill(name);
      return successResponse();
    } catch (error) {
      return errorResponse(error);
    }
  });

  ipcMain.handle("skills:load", async (_e, name: string) => {
    try {
      const service = getService();
      if (!service) return errorResponse("SkillService not available");
      const content = await service.loadSkill(name);
      return successResponse(content);
    } catch (error) {
      return errorResponse(error);
    }
  });

  ipcMain.handle(
    "skills:load-resource",
    async (_e, name: string, relativePath: string) => {
      try {
        if (!name || !relativePath || relativePath.includes("..")) {
          return errorResponse("Invalid parameters");
        }
        const service = getService();
        if (!service) return errorResponse("SkillService not available");
        const text = await service.loadResource(name, relativePath);
        return successResponse(text);
      } catch (error) {
        return errorResponse(error);
      }
    },
  );
}
