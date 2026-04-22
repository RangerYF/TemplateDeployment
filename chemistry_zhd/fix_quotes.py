import re

filepath = 'D:/Company/chemistry_anim/packages/c04-periodic-table/src/data/elements.ts'

with open(filepath, 'rb') as f:
    raw = f.read()

# Normalize line endings to LF
content = raw.replace(b'\r\n', b'\n').replace(b'\r', b'\n').decode('utf-8')

lines = content.split('\n')
result = []

for line in lines:
    # Match TS string property assignments: e.g.   propName: "value with "inner" quotes",
    m = re.match(r'^(\s*\w+:\s+)"(.*)"(,\s*)$', line)
    if m:
        prefix = m.group(1) + '"'
        # The value is everything between the first and last " on the line
        # Find first " after ': ' and last " before trailing ','
        colon_quote = line.index(': "') + 3  # position just after opening "
        # Find last " before end
        last_quote = line.rindex('"')
        value = line[colon_quote:last_quote]
        suffix = '"' + line[last_quote+1:]
        # Escape any unescaped " in value
        escaped = value.replace('\\"', '\x00ESCAPED\x00').replace('"', '\\"').replace('\x00ESCAPED\x00', '\\"')
        result.append(line[:colon_quote] + escaped + suffix)
    else:
        # Match array string items: e.g.   "some text with "quotes",
        m2 = re.match(r'^(\s+)"(.*)"(,\s*)$', line)
        if m2 and not re.match(r'^\s*\w+:', line):
            # Find first " and last " on line
            first_q = line.index('"')
            last_q = line.rindex('"')
            if first_q < last_q:
                value = line[first_q+1:last_q]
                escaped = value.replace('\\"', '\x00ESCAPED\x00').replace('"', '\\"').replace('\x00ESCAPED\x00', '\\"')
                result.append(line[:first_q+1] + escaped + line[last_q:])
            else:
                result.append(line)
        else:
            result.append(line)

fixed = '\n'.join(result)
with open(filepath, 'w', encoding='utf-8', newline='\n') as f:
    f.write(fixed)

print(f'Done. {len(result)} lines processed.')
