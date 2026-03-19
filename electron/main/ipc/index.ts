import { registerEkoHandlers } from "./eko-handlers";
import { registerViewHandlers } from "./view-handlers";
import { registerHistoryHandlers } from "./history-handlers";
import { registerConfigHandlers } from "./config-handlers";
import { registerAgentHandlers } from "./agent-handlers";
import { registerFileHandlers } from "./file-handlers";
import { registerSettingsHandlers } from "./settings-handlers";
import { registerTabHandlers } from "./tab-handlers";
import { registerSkillHandlers } from "./skill-handlers";

export function registerAllIpcHandlers() {
  registerEkoHandlers();
  registerViewHandlers();
  registerHistoryHandlers();
  registerConfigHandlers();
  registerAgentHandlers();
  registerFileHandlers();
  registerSettingsHandlers();
  registerTabHandlers();
  registerSkillHandlers();
}

export {
  registerEkoHandlers,
  registerViewHandlers,
  registerHistoryHandlers,
  registerConfigHandlers,
  registerAgentHandlers,
  registerFileHandlers,
  registerSettingsHandlers,
  registerTabHandlers,
  registerSkillHandlers
};
