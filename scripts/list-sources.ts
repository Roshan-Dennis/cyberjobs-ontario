import { ALL_SOURCES } from '../src/lib/sources/registry';

for (const s of ALL_SOURCES) {
  const state = s.isEnabled() ? 'enabled ' : 'disabled';
  console.log(`${state}  ${s.id.padEnd(18)} ${s.name}`);
  console.log(`          ${s.access}`);
  if (!s.isEnabled() && s.disabledReason) console.log(`          -> ${s.disabledReason()}`);
  console.log();
}
