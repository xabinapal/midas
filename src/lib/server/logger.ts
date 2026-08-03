import { dev } from "$app/environment";
import { formatLine, type LogLevel } from "./logfmt";

export type { LogLevel };

type Fields = Record<string, unknown>;

const LEVEL_VALUE: Record<LogLevel, number> = {
	debug: 10,
	info: 20,
	warn: 30,
	error: 40,
};

const minLevel: LogLevel = dev ? "debug" : "info";

function emit(level: LogLevel, msg: string, fields: Fields): void {
	if (LEVEL_VALUE[level] < LEVEL_VALUE[minLevel]) {
		return;
	}

	const line = formatLine(level, msg, fields);

	if (level === "error") {
		console.error(line);
	} else if (level === "warn") {
		console.warn(line);
	} else if (level === "info") {
		console.info(line);
	} else {
		console.log(line);
	}
}

export const logger = {
	log(level: LogLevel, msg: string, fields: Fields = {}) {
		emit(level, msg, fields);
	},
	debug(msg: string, fields: Fields = {}) {
		emit("debug", msg, fields);
	},
	info(msg: string, fields: Fields = {}) {
		emit("info", msg, fields);
	},
	warn(msg: string, fields: Fields = {}) {
		emit("warn", msg, fields);
	},
	error(msg: string, fields: Fields = {}) {
		emit("error", msg, fields);
	},
};
