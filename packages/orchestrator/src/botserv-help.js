const TOPICS = {
  AGENTS: [
    'Agent commands',
    'AGENTS - list managed agents plus helper',
    'SHOW <id> - show context, skills, route, and model metadata',
    'CREATE <id> --nick <nick> --role <role>',
    '  --context "text" [--skills a,b] [--capacity n]',
    'UPDATE <id> [--nick n] [--role r] [--context "text"]',
    'DELETE <id> - remove a managed agent',
  ],
  TASKS: [
    'Task commands',
    'NEW "title" - create a task channel through BotService',
    '@orc new "title" - create and route a task through orchestrator',
    '@orc tasks - list task status',
    '@orc logs <TASK-0001> - show task timeline',
  ],
  SKILLS: [
    'Skill commands',
    'SKILLS - list available skill packs',
    'SKILLPACK CREATE <id> --skills a,b --match words',
    'CREATE <id> ... --skills a,b - force explicit skills',
    'Omit --skills to infer a pack from role/context/strengths',
  ],
  MODELS: [
    'Model commands',
    'MODEL <id> --provider codex|openai|ollama|glm-5.2-z-ai',
    '  --auth login|api-key|local [--name model-name]',
    'CREATE/UPDATE also accept --model, --provider, --auth, --model-name',
    'Use login for codex/z-ai login, api-key for OpenAI or z-ai keys, local for Ollama',
  ],
  OPS: [
    'Ops commands',
    'BUILD - run npm run typecheck for the repo',
    'RESTART - restart Docker, helper, BotService, and orchestrator',
    'DEPLOY - build, then restart the entire local service',
    'Use DEPLOY after feature edits to load new control-plane code',
  ],
  CODEX: [
    'Helper commands',
    '@codex <message> - ask helper from a channel',
    '/msg helper <message> - ask helper privately',
    '@codex login - request the Codex login URL',
    'helper can explain README and BotService commands',
  ],
};

function helpLines(topic) {
  const normalized = (topic || '').toUpperCase();
  if (TOPICS[normalized]) return TOPICS[normalized];
  if (normalized) {
    return [`Unknown help topic: ${topic}`, ...summaryLines()];
  }
  return summaryLines();
}

function summaryLines() {
  return [
    'BotService help',
    'HELP AGENTS - create, edit, delete, and inspect agents',
    'HELP TASKS - create task channels and inspect task flow',
    'HELP SKILLS - list or draft skill packs',
    'HELP MODELS - set per-agent model provider and auth mode',
    'HELP OPS - build, restart, or deploy the local service',
    'HELP CODEX - use helper for README and command assistance',
  ];
}

module.exports = {
  helpLines,
};
