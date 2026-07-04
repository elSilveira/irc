import net from 'node:net';

export interface ParsedLine {
  prefix: string | null;
  command: string;
  params: string[];
}

export function parseLine(line: string): ParsedLine {
  const parsed: ParsedLine = { prefix: null, command: '', params: [] };
  let rest = line.trimEnd();

  if (rest.startsWith(':')) {
    const space = rest.indexOf(' ');
    parsed.prefix = rest.slice(1, space);
    rest = rest.slice(space + 1);
  }

  const trailingIndex = rest.indexOf(' :');
  const trailing = trailingIndex === -1 ? null : rest.slice(trailingIndex + 2);
  const head = trailingIndex === -1 ? rest : rest.slice(0, trailingIndex);
  const parts = head.split(' ').filter(Boolean);

  parsed.command = parts.shift() ?? '';
  parsed.params = trailing === null ? parts : [...parts, trailing];
  return parsed;
}

const CRLF = '\r\n';
const MAX_LINE_BYTES = 512;

export const format = {
  nick: (nick: string) => `NICK ${nick}${CRLF}`,
  user: (user: string) => `USER ${user} 0 * :${user}${CRLF}`,
  join: (channel: string) => `JOIN ${channel}${CRLF}`,
  privmsg: (target: string, text: string) => safeLine(`PRIVMSG ${target} :`, text),
  pong: (server: string) => `PONG :${server}${CRLF}`,
  quit: (message: string) => `QUIT :${message}${CRLF}`,
};

function safeLine(prefix: string, text: string): string {
  let body = text.replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
  while (Buffer.byteLength(`${prefix}${body}${CRLF}`, 'utf8') > MAX_LINE_BYTES) {
    body = body.slice(0, -1);
  }
  return `${prefix}${body}${CRLF}`;
}

export function nickFromPrefix(prefix: string | null): string {
  return (prefix ?? '').split('!')[0] ?? '';
}

export interface IrcHandlers {
  onReady?: () => void;
  onLine?: (line: ParsedLine) => void;
  onError?: (error: Error) => void;
}

export interface IrcClientOptions {
  host: string;
  port: number;
  nick: string;
  handlers?: IrcHandlers;
}

export class IrcClient {
  private readonly socket: net.Socket;
  private buffer = '';
  private readonly handlers: IrcHandlers;
  readonly nick: string;

  constructor(options: IrcClientOptions) {
    this.nick = options.nick;
    this.handlers = options.handlers ?? {};
    this.socket = net.createConnection(options.port, options.host);
    this.socket.on('connect', () => {
      this.send(format.nick(this.nick));
      this.send(format.user(this.nick));
    });
    this.socket.on('data', (chunk) => this.onData(chunk));
    this.socket.on('error', (error) => this.handlers.onError?.(error));
  }

  send(raw: string): void {
    this.socket.write(raw);
  }

  join(channel: string): void {
    this.send(format.join(channel));
  }

  privmsg(target: string, text: string): void {
    this.send(format.privmsg(target, text));
  }

  /** Send QUIT and tear down the socket. Safe to call when already closed. */
  quit(message = 'disconnect'): void {
    if (this.socket.writable) this.send(format.quit(message));
    this.socket.destroy();
  }

  private onData(chunk: Buffer): void {
    this.buffer += chunk.toString('utf8');
    const lines = this.buffer.split('\r\n');
    this.buffer = lines.pop() ?? '';
    for (const line of lines) {
      const parsed = parseLine(line);
      if (parsed.command === 'PING') {
        this.send(format.pong(parsed.params.at(-1) ?? ''));
        continue;
      }
      if (parsed.command === '001') {
        this.handlers.onReady?.();
      }
      this.handlers.onLine?.(parsed);
    }
  }
}
