type LogLevel = "error" | "warn" | "info" | "debug";

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

type LoggerMeta = Record<string, unknown> | undefined;

function resolveLevel(): LogLevel {
  const raw = String(process.env.LOG_LEVEL || "").toLowerCase();
  if (raw in LEVEL_PRIORITY) return raw as LogLevel;
  if (String(process.env.DEBUG || "") === "1") return "debug";
  if (String(process.env.ELECTRON_DEBUG || "") === "1") return "debug";
  return "info";
}

const CURRENT_LEVEL = resolveLevel();

function shouldLog(level: LogLevel): boolean {
  return LEVEL_PRIORITY[level] <= LEVEL_PRIORITY[CURRENT_LEVEL];
}

function serialize(meta: LoggerMeta): string {
  if (!meta) return "";
  try {
    return ` ${JSON.stringify(meta)}`;
  } catch {
    return " [unserializable-meta]";
  }
}

type Logger = {
  error: (message: string, meta?: LoggerMeta) => void;
  warn: (message: string, meta?: LoggerMeta) => void;
  info: (message: string, meta?: LoggerMeta) => void;
  debug: (message: string, meta?: LoggerMeta) => void;
};

function createLogger(scope: string): Logger {
  function write(level: LogLevel, message: string, meta?: LoggerMeta): void {
    if (!shouldLog(level)) return;
    const ts = new Date().toISOString();
    const line = `${ts} [${level.toUpperCase()}] [${scope}] ${message}${serialize(meta)}`;
    if (level === "error") {
      console.error(line);
      return;
    }
    if (level === "warn") {
      console.warn(line);
      return;
    }
    console.log(line);
  }

  return {
    error(message, meta) {
      write("error", message, meta);
    },
    warn(message, meta) {
      write("warn", message, meta);
    },
    info(message, meta) {
      write("info", message, meta);
    },
    debug(message, meta) {
      write("debug", message, meta);
    },
  };
}

export { createLogger };
