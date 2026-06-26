import { NavLink } from 'react-router';

export function AppNav() {
  return (
    <header className="border-b border-gray-200">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
        <NavLink to="/gardens" className="flex items-center gap-2 text-base font-medium">
          <span aria-hidden="true">🌱</span> Home garden
        </NavLink>
        <span className="flex items-center gap-2 text-sm text-gray-600">
          Home gardener
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100 text-xs font-medium text-emerald-700">
            HG
          </span>
        </span>
      </div>
    </header>
  );
}
