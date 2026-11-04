"""One-shot, tool-less prompts through the installed, signed-in GitHub Copilot CLI."""
import json
import os
from pathlib import Path
import re
import shutil
import subprocess

# Values accepted by `copilot --reasoning-effort`; the CLI reports an error when a model rejects one.
COPILOT_EFFORTS = ['low', 'medium', 'high', 'xhigh']


def copilot_executable():
    configured = os.environ.get('COPILOT_CLI_PATH')
    if configured and Path(configured).is_file():
        return configured
    executable = shutil.which('copilot.exe') or shutil.which('copilot')
    if not executable:
        raise ValueError('未找到 GitHub Copilot CLI。请安装并运行 copilot login 后重试。')
    return executable


def copilot_models():
    # `copilot help config` documents the `model` setting with the catalog this CLI build accepts.
    try:
        result = subprocess.run([copilot_executable(), 'help', 'config'], capture_output=True, timeout=25,
                                creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0)
    except (OSError, subprocess.TimeoutExpired) as error:
        raise ValueError('无法读取 Copilot 模型列表，可继续使用默认模型。') from error
    text = result.stdout.decode('utf-8', errors='replace')
    section = re.search(r'^\s*`model`:.*?\n((?:\s+- "[^"]+"\n)+)', text, re.M)
    if result.returncode or not section:
        raise ValueError('无法读取 Copilot 模型列表，可继续使用默认模型。')
    return [{'id': slug, 'name': slug, 'efforts': COPILOT_EFFORTS, 'default_effort': ''}
            for slug in re.findall(r'- "([^"]+)"', section[1])]


def copilot_command(directory, model='', effort=''):
    # Prompt mode without --allow-all-tools denies every tool request; the empty temporary
    # working directory keeps repository files and custom instructions out of the request.
    command = [copilot_executable(), '-C', str(directory), '--output-format', 'json', '--stream', 'off',
               '--no-color', '--no-ask-user', '--no-custom-instructions', '--disable-builtin-mcps',
               '--disallow-temp-dir', '--no-auto-update']
    if model:
        command += ['--model', model]
    if model and effort:  # the default model may not accept an effort level
        command += ['--reasoning-effort', effort]
    return command


def schema_instructions(schema):
    return ('Use no tools. Return ONLY one JSON object, without code fences or commentary, '
            'conforming to this JSON schema: ' + json.dumps(schema) + '\n')


def parse_json_object(text):
    text = text.strip()
    fenced = re.fullmatch(r'```[a-zA-Z]*\n(.*)\n```', text, re.S)
    value = json.loads(fenced[1] if fenced else text)
    if not isinstance(value, dict):
        raise ValueError('not an object')
    return value


def validate(value, schema):
    """Check the JSON-schema subset used by the editor (object, array, string, integer, null, enum)."""
    types = schema.get('type')
    types = types if isinstance(types, list) else [types]
    names = {'object': dict, 'array': list, 'string': str, 'null': type(None)}
    if not any((kind == 'integer' and type(value) is int) or isinstance(value, names.get(kind, ())) for kind in types):
        return False
    if 'enum' in schema and value not in schema['enum']:
        return False
    if isinstance(value, dict):
        properties = schema.get('properties', {})
        if any(key not in value for key in schema.get('required', ())):
            return False
        if schema.get('additionalProperties') is False and set(value) - set(properties):
            return False
        return all(validate(value[key], rule) for key, rule in properties.items() if key in value)
    if isinstance(value, list):
        return all(validate(item, schema.get('items', {})) for item in value)
    return True


def copilot_answer(stdout, returncode, schema, stderr=b''):
    answer, error, tools = None, '', False
    lines = [line for line in stderr.decode('utf-8', errors='replace').splitlines() if line.strip()]
    if lines:
        error = lines[-1].removeprefix('Error: ')[:300]
    for line in stdout.decode('utf-8', errors='replace').splitlines():
        try:
            event = json.loads(line)
        except ValueError:
            continue
        if not isinstance(event, dict):
            continue
        kind, data = event.get('type', ''), event.get('data') or {}
        if kind == 'assistant.message' and isinstance(data.get('content'), str) and data['content'].strip():
            answer = data['content']
        elif kind.startswith('tool.execution'):
            tools = True
        elif kind.endswith('error') and isinstance(data, dict):
            error = data.get('message') or error
    if returncode or answer is None:
        raise ValueError(error or 'Copilot 未返回结果，请确认已运行 copilot login 并检查网络后重试。')
    try:
        result = parse_json_object(answer)
    except ValueError as failure:
        raise ValueError('Copilot 返回的不是有效 JSON' + ('（尝试调用了工具）' if tools else '') + '，请重试。') from failure
    if not validate(result, schema):
        raise ValueError('Copilot 返回的 JSON 不符合要求的格式，请重试。')
    return result
