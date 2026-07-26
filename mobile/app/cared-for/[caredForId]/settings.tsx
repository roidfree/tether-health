import CarerSettingsPanel from '../../../components/CarerSettingsPanel';

// The carer's own settings (app language, logout) are general to the carer's
// account, not scoped to whichever cared-for they're currently viewing - so
// this is the exact same panel shown from the cared-for list's Settings tab
// (app/carer-home/settings.tsx), not a per-person variant.
export default function CaredForSettings() {
  return <CarerSettingsPanel />;
}
