import { h } from '../../ui/src/dom.js';
import { tokenize } from '../../core/src/index.js';
import { basename, dirname, normalizePath } from '../../filesystem/src/index.js';

export function createTerminal(sys, args = {}) {
  const win = sys.createWindow({
    title: 'MS-DOS Prompt',
    icon: 'cmd',
    width: 680,
    height: 420,
    minWidth: 320,
    minHeight: 220,
  });
  const terminal = h('div', { class: 'terminal', tabIndex: 0 }),
    output = h('div', { class: 'terminal-output' }),
    prefix = h('span'),
    input = h('input', { 'aria-label': 'Command', autocomplete: 'off', spellcheck: false }),
    prompt = h('div', { class: 'terminal-prompt' }, prefix, input);
  terminal.append(output, prompt);
  win.content.append(terminal);
  let cwd = args.path ?? 'C:\\Windows\\Desktop',
    history = [],
    historyIndex = 0,
    busy = false,
    promptTemplate = '$P$G';
  const env = {
    COMSPEC: 'C:\\WINDOWS\\COMMAND.COM',
    PATH: 'C:\\WINDOWS;C:\\WINDOWS\\COMMAND',
    TEMP: 'C:\\WINDOWS\\TEMP',
    WINDIR: 'C:\\WINDOWS',
    OS: 'Windows_ME',
    USERNAME: sys.settings.get('userName'),
  };
  const line = (text) => {
    output.append(document.createTextNode(String(text) + '\n'));
    terminal.scrollTop = terminal.scrollHeight;
  };
  const update = () => {
    prefix.textContent = promptTemplate
      .replace(/\$P/gi, cwd)
      .replace(/\$G/gi, '>')
      .replace(/\$N/gi, cwd[0])
      .replace(/\$D/gi, new Date().toLocaleDateString())
      .replace(/\$T/gi, new Date().toLocaleTimeString())
      .replace(/\$\$/g, '$');
  };
  const resolve = (p) => normalizePath(p ?? '', cwd);
  const wildcard = (pattern) => {
    const p = resolve(pattern ?? '*');
    const name = basename(p);
    if (!/[?*]/.test(name)) return sys.fs.exists(p) ? [sys.fs.stat(p)] : [];
    return sys.fs
      .search(name, dirname(p))
      .filter((n) => dirname(n.path).toLowerCase() === dirname(p).toLowerCase());
  };
  const matchFiles = (pattern) => {
    if (!pattern) return sys.fs.list(cwd, { hidden: true });
    if (/[?*]/.test(pattern)) {
      const i = pattern.replaceAll('/', '\\').lastIndexOf('\\');
      const directory = i >= 0 ? resolve(pattern.slice(0, i) || '\\') : cwd;
      const glob = i >= 0 ? pattern.slice(i + 1) : pattern;
      return sys.fs
        .search(glob, directory)
        .filter((n) => dirname(n.path).toLowerCase() === directory.toLowerCase());
    }
    const p = resolve(pattern),
      n = sys.fs.stat(p);
    return n?.kind === 'directory' ? sys.fs.list(p, { hidden: true }) : n ? [n] : [];
  };
  const builtins = {
    HELP: () =>
      `For more information on a specific command, type HELP command.\n\nATTRIB   Displays or changes file attributes.\nCD       Displays or changes the current directory.\nCLS      Clears the screen.\nCOPY     Copies files.\nDATE     Displays the date.\nDEL      Deletes files permanently.\nDIR      Lists files and subdirectories.\nECHO     Displays messages or writes to files.\nEDIT     Opens a file in Notepad.\nEXIT     Closes the MS-DOS Prompt.\nFC       Compares two text files.\nFIND     Searches for text in a file.\nMD       Creates a directory.\nMEM      Displays browser memory information.\nMOVE     Moves files and directories.\nPATH     Displays or sets the command path.\nPROMPT   Changes the command prompt.\nRD       Removes an empty directory.\nREN      Renames a file or directory.\nSET      Displays or sets environment variables.\nSTART    Starts a Millennium application or opens a file.\nTIME     Displays the time.\nTREE     Displays the directory structure.\nTYPE     Displays a text file.\nVER      Displays the Windows version.\nVOL      Displays the drive label.\n\nUse quotes around paths containing spaces. Redirection > and >>, pipes, and BAT files are supported.`,
    VER: () => 'Microsoft Windows [Version 4.90.3000]\nMillennium browser command environment',
    CLS: () => {
      output.textContent = '';
      return '';
    },
    CD: async (args) => {
      const p = args.filter((a) => a.toLowerCase() !== '/d').join(' ');
      if (!p) return cwd;
      const next = resolve(p);
      if (sys.fs.stat(next)?.kind !== 'directory') throw new Error('Invalid directory');
      cwd = next;
      return '';
    },
    DIR: (args) => {
      const flags = args.filter((a) => a.startsWith('/')).map((s) => s.toLowerCase()),
        spec = args.find((a) => !a.startsWith('/'));
      const entries = matchFiles(spec).filter((n) => flags.includes('/a') || !n.hidden);
      if (flags.includes('/b')) return entries.map((n) => n.name).join('\n');
      let count = 0,
        total = 0;
      const rows = entries.map((n) => {
        if (n.kind === 'file') {
          count++;
          total += n.size ?? 0;
        }
        const date = new Date(n.modified);
        const stamp =
          date.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: '2-digit' }) +
          '  ' +
          date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
        return `${stamp}  ${n.kind === 'directory' ? '     <DIR>' : String(n.size ?? 0).padStart(10)}  ${n.name}`;
      });
      return ` Volume in drive ${cwd[0]} is MILLENNIUM\n Directory of ${spec && !/[?*]/.test(spec) && sys.fs.stat(resolve(spec))?.kind === 'directory' ? resolve(spec) : cwd}\n\n${rows.join('\n')}\n${String(count).padStart(10)} file(s) ${total.toLocaleString().padStart(14)} bytes\n${String(entries.length - count).padStart(10)} dir(s)`;
    },
    MD: async (args) => {
      if (!args.length) throw new Error('Required parameter missing');
      await sys.fs.mkdir(resolve(args.join(' ')));
      return '';
    },
    RD: async (args) => {
      const p = resolve(args.join(' '));
      if (sys.fs.list(p, { hidden: true }).length) throw new Error('The directory is not empty');
      await sys.fs.remove(p, { permanent: true });
      return '';
    },
    TYPE: (args) => {
      if (!args.length) throw new Error('Required parameter missing');
      return args.map((p) => sys.fs.readFile(resolve(p))).join('\n');
    },
    ECHO: (args) => args.join(' '),
    'ECHO.': () => '',
    COPY: async (args) => {
      if (args.length < 2) throw new Error('Required parameter missing');
      const src = matchFiles(args[0]).filter((n) => n.kind === 'file'),
        dest = resolve(args[1]);
      if (!src.length) throw new Error('File not found');
      if (src.length > 1 && sys.fs.stat(dest)?.kind !== 'directory')
        throw new Error('The destination must be a directory');
      for (const n of src) {
        const p = sys.fs.stat(dest)?.kind === 'directory' ? dest + '\\' + n.name : dest;
        if (sys.fs.exists(p)) {
          if (!(await sys.dialogs.confirm(`Overwrite ${p}?`, 'COPY'))) continue;
          await sys.fs.writeFile(p, sys.fs.readFile(n.path, 'bytes'), n.mime);
        } else await sys.fs.copy(n.path, p);
      }
      return `        ${src.length} file(s) copied`;
    },
    MOVE: async (args) => {
      if (args.length < 2) throw new Error('Required parameter missing');
      const src = resolve(args[0]),
        dest = resolve(args[1]);
      await sys.fs.move(
        src,
        sys.fs.stat(dest)?.kind === 'directory' ? dest + '\\' + basename(src) : dest,
      );
      return '        1 file(s) moved';
    },
    REN: async (args) => {
      if (args.length < 2) throw new Error('Required parameter missing');
      await sys.fs.rename(resolve(args[0]), args[1]);
      return '';
    },
    DEL: async (args) => {
      const spec = args.find((a) => !a.startsWith('/'));
      if (!spec) throw new Error('Required parameter missing');
      const files = matchFiles(spec).filter((n) => n.kind === 'file');
      if (!files.length) throw new Error('File not found');
      if (
        files.length > 1 &&
        !(await sys.dialogs.confirm(`Permanently delete ${files.length} files?`, 'DEL'))
      )
        return '';
      for (const n of files) await sys.fs.remove(n.path, { permanent: true });
      return '';
    },
    DATE: () => 'Current date is ' + new Date().toLocaleDateString(),
    TIME: () => 'Current time is ' + new Date().toLocaleTimeString(),
    VOL: () => ` Volume in drive ${cwd[0]} is MILLENNIUM\n Volume Serial Number is 0900-3000`,
    MEM: () => {
      const m = performance.memory;
      return `Browser virtual memory\n\n${m ? Math.round(m.usedJSHeapSize / 1024).toLocaleString() + ' KB used JavaScript heap\n' + Math.round(m.jsHeapSizeLimit / 1024).toLocaleString() + ' KB heap limit' : 'JavaScript heap statistics are unavailable in this browser.'}\n\nVirtual drive: ${sys.fs.nodes.size} entries\nNative DOS memory and drivers are not emulated.`;
    },
    SET: (args) => {
      if (!args.length)
        return Object.entries(env)
          .map(([k, v]) => k + '=' + v)
          .join('\n');
      const value = args.join(' '),
        index = value.indexOf('=');
      if (index < 0)
        return Object.entries(env)
          .filter(([k]) => k.startsWith(value.toUpperCase()))
          .map(([k, v]) => k + '=' + v)
          .join('\n');
      const key = value.slice(0, index).toUpperCase();
      if (!value.slice(index + 1)) delete env[key];
      else env[key] = value.slice(index + 1);
      return '';
    },
    PATH: (args) => {
      if (args.length) env.PATH = args.join(' ');
      return 'PATH=' + env.PATH;
    },
    PROMPT: (args) => {
      promptTemplate = args.join(' ') || '$P$G';
      return '';
    },
    TREE: (args) => {
      let root = args.find((a) => !a.startsWith('/'))
        ? resolve(args.find((a) => !a.startsWith('/')))
        : cwd;
      const all = args.some((a) => a.toLowerCase() === '/f'),
        rows = [root];
      const visit = (p, depth) => {
        if (depth > 20) return;
        for (const n of sys.fs.list(p, { hidden: false })) {
          if (n.kind === 'directory' || all)
            rows.push('  '.repeat(depth + 1) + (n.kind === 'directory' ? '[+] ' : '    ') + n.name);
          if (n.kind === 'directory') visit(n.path, depth + 1);
        }
      };
      visit(root, 0);
      return rows.join('\n');
    },
    FIND: (args, stdin) => {
      const insensitive = args.some((a) => a.toLowerCase() === '/i'),
        parts = args.filter((a) => !a.startsWith('/'));
      if (!parts[0]) throw new Error('Required parameter missing');
      const text = parts[1] ? sys.fs.readFile(resolve(parts[1])) : (stdin ?? '');
      return text
        .split(/\r?\n/)
        .filter((l) =>
          (insensitive ? l.toLowerCase() : l).includes(
            insensitive ? parts[0].toLowerCase() : parts[0],
          ),
        )
        .join('\n');
    },
    MORE: (args, stdin) => (args.length ? sys.fs.readFile(resolve(args[0])) : (stdin ?? '')),
    FC: (args) => {
      if (args.length < 2) throw new Error('Required parameter missing');
      const a = sys.fs.readFile(resolve(args[0])).split(/\r?\n/),
        b = sys.fs.readFile(resolve(args[1])).split(/\r?\n/);
      const diff = [];
      for (let i = 0; i < Math.max(a.length, b.length); i++)
        if (a[i] !== b[i]) diff.push(`Line ${i + 1}\n< ${a[i] ?? ''}\n> ${b[i] ?? ''}`);
      return diff.length ? diff.join('\n') : 'FC: no differences encountered';
    },
    ATTRIB: async (args) => {
      const options = args.filter((a) => /^[+-][RHA]$/i.test(a)),
        spec = args.find((a) => !options.includes(a)) ?? '*';
      const files = matchFiles(spec);
      if (!options.length)
        return files
          .map((n) => `${n.readonly ? 'R' : ' '} ${n.hidden ? 'H' : ' '}    ${n.path}`)
          .join('\n');
      for (const n of files) {
        let attrs = {};
        for (const o of options) {
          if (o[1].toLowerCase() === 'r') attrs.readonly = o[0] === '+';
          if (o[1].toLowerCase() === 'h') attrs.hidden = o[0] === '+';
        }
        await sys.fs.setAttributes(n.path, attrs);
      }
      return '';
    },
    START: async (args) => {
      if (!args.length) {
        sys.launch('terminal', { path: cwd });
        return '';
      }
      const id = args.shift();
      if (sys.registry.get(id))
        await sys.launch(id, {
          commandArgs: args,
          path: args[0] && sys.fs.exists(resolve(args[0])) ? resolve(args[0]) : undefined,
        });
      else await sys.open(resolve(id));
      return '';
    },
    EDIT: async (args) => {
      if (!args.length) sys.launch('notepad');
      else {
        const p = resolve(args.join(' '));
        if (!sys.fs.exists(p)) await sys.fs.writeFile(p, '');
        sys.launch('notepad', { path: p });
      }
      return '';
    },
    EXIT: () => {
      win.close();
      return '';
    },
    REM: () => '',
    PAUSE: () =>
      new Promise((resolve) => {
        line('Press Enter to continue . . .');
        win.element.focus();
        const resume = (e) => {
          if (e && e.key !== 'Enter') return;
          e?.preventDefault();
          win.element.removeEventListener('keydown', resume);
          resolve('');
        };
        win.element.addEventListener('keydown', resume);
        win.onDispose(() => resume());
      }),
    COLOR: (args) => {
      const colors = [
        '#000',
        '#00a',
        '#0a0',
        '#0aa',
        '#a00',
        '#a0a',
        '#a50',
        '#aaa',
        '#555',
        '#55f',
        '#5f5',
        '#5ff',
        '#f55',
        '#f5f',
        '#ff5',
        '#fff',
      ];
      const value = args[0] ?? '07';
      if (!/^[\da-f]{2}$/i.test(value)) throw new Error('Invalid color');
      terminal.style.background = colors[parseInt(value[0], 16)];
      terminal.style.color = colors[parseInt(value[1], 16)];
      input.style.setProperty('background', terminal.style.background, 'important');
      input.style.setProperty('color', terminal.style.color, 'important');
      return '';
    },
    CHKDSK: () =>
      `Virtual drive consistency check\n${sys.fs.walk('C:\\').length} entries examined.\nAll paths are managed by atomic filesystem transactions.\n\nThis checks the browser drive; physical disks are not accessible.`,
  };
  Object.assign(builtins, {
    CHDIR: builtins.CD,
    MKDIR: builtins.MD,
    RMDIR: builtins.RD,
    RENAME: builtins.REN,
    ERASE: builtins.DEL,
  });
  const execute = async (raw, stdin = '', depth = 0) => {
    if (depth > 16) throw new Error('Batch recursion limit exceeded');
    raw = raw
      .trim()
      .replace(/^@/, '')
      .replace(/%([^%]+)%/g, (_, key) => env[key.toUpperCase()] ?? '');
    if (!raw) return '';
    let quote = false,
      redirect = -1,
      pipe = -1;
    for (let i = 0; i < raw.length; i++) {
      if (raw[i] === '"') quote = !quote;
      if (!quote && raw[i] === '>') {
        redirect = i;
        break;
      }
      if (!quote && raw[i] === '|') {
        pipe = i;
        break;
      }
    }
    if (pipe >= 0) {
      const output = await execute(raw.slice(0, pipe), stdin, depth + 1);
      return execute(raw.slice(pipe + 1), output, depth + 1);
    }
    if (redirect >= 0) {
      const append = raw[redirect + 1] === '>',
        target = raw
          .slice(redirect + (append ? 2 : 1))
          .trim()
          .replace(/^"|"$/g, ''),
        p = resolve(target);
      const result = await execute(raw.slice(0, redirect), stdin, depth + 1);
      await sys.fs.writeFile(
        p,
        (append && sys.fs.exists(p) ? sys.fs.readFile(p) : '') + result + '\r\n',
      );
      return '';
    }
    if (/^[a-z]:$/i.test(raw)) {
      const drive = raw.toUpperCase() + '\\';
      if (!sys.fs.exists(drive)) throw new Error('Invalid drive specification');
      cwd = drive;
      return '';
    }
    if (/^cd\.\./i.test(raw)) raw = 'cd ' + raw.slice(2);
    const [command, ...args] = tokenize(raw),
      name = command.toUpperCase();
    if (builtins[name]) return await builtins[name](args, stdin);
    if (name === 'COMMAND' || name === 'COMMAND.COM') {
      const sub = args[0]?.toLowerCase() === '/c' ? args.slice(1) : args;
      return sub.length ? execute(sub.join(' '), stdin, depth + 1) : '';
    }
    let file;
    try {
      file = resolve(command);
      if (!sys.fs.exists(file) && sys.fs.exists(file + '.bat')) file += '.bat';
    } catch {}
    if (file && /\.bat$/i.test(file) && sys.fs.exists(file)) {
      let result = [];
      const lines = sys.fs.readFile(file).split(/\r?\n/);
      for (let i = 0, count = 0; i < lines.length && count++ < 1000; i++) {
        let row = lines[i].trim();
        if (row.startsWith(':') || !row) continue;
        row = row.replace(/%([0-9])/g, (_, n) => (n === '0' ? file : (args[+n - 1] ?? '')));
        if (/^goto\s+/i.test(row)) {
          const label = row.slice(5).trim().toLowerCase();
          const at = lines.findIndex((l) => l.trim().toLowerCase() === ':' + label);
          if (at < 0) throw new Error('Label not found');
          i = at;
          continue;
        }
        if (/^echo\s+(off|on)$/i.test(row.replace(/^@/, ''))) continue;
        result.push(await execute(row, stdin, depth + 1));
      }
      return result.filter(Boolean).join('\n');
    }
    if (sys.registry.get(command)) {
      await sys.launch(command, {
        commandArgs: args,
        path: args[0] && sys.fs.exists(resolve(args[0])) ? resolve(args[0]) : undefined,
      });
      return '';
    }
    if (/\.(exe|com)$/i.test(command))
      throw new Error(
        'This executable is not a registered Millennium application. Native x86/Win32 binary execution is not available.',
      );
    throw new Error('Bad command or file name');
  };
  input.addEventListener('keydown', async (e) => {
    if (e.key === 'Enter' && !busy) {
      e.preventDefault();
      const command = input.value;
      line(prefix.textContent + command);
      input.value = '';
      history.push(command);
      historyIndex = history.length;
      busy = true;
      input.disabled = true;
      try {
        const result = await execute(command);
        if (result) line(result);
      } catch (error) {
        line(error.message);
      } finally {
        busy = false;
        input.disabled = false;
        update();
        input.focus();
        terminal.scrollTop = terminal.scrollHeight;
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      historyIndex = Math.max(0, historyIndex - 1);
      input.value = history[historyIndex] ?? '';
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      historyIndex = Math.min(history.length, historyIndex + 1);
      input.value = history[historyIndex] ?? '';
    } else if (e.key === 'Tab') {
      e.preventDefault();
      const parts = input.value.split(' '),
        last = parts.at(-1);
      const candidates = sys.fs
        .list(cwd)
        .filter((n) => n.name.toLowerCase().startsWith(last.replaceAll('"', '').toLowerCase()));
      if (candidates[0]) {
        parts[parts.length - 1] = candidates[0].name.includes(' ')
          ? '"' + candidates[0].name + '"'
          : candidates[0].name;
        input.value = parts.join(' ');
      }
    } else if (e.ctrlKey && e.key === 'c' && !getSelection()?.toString()) {
      e.preventDefault();
      line(prefix.textContent + input.value + '^C');
      input.value = '';
    }
  });
  terminal.addEventListener('click', () => {
    if (!getSelection()?.toString()) input.focus();
  });
  line(
    'Microsoft Windows [Version 4.90.3000]\nMillennium browser command environment\n\nType HELP for available commands.\n',
  );
  update();
  requestAnimationFrame(() => input.focus());
  win.execute = execute;
  return win;
}
