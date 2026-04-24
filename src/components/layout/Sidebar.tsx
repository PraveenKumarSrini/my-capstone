import NavLinks from './NavLinks'
import AccountSwitcher from './AccountSwitcher'

export default function Sidebar() {
  return (
    <aside className="flex h-full w-60 flex-col border-r border-gray-200 bg-white">
      <div className="flex h-14 items-center border-b border-gray-200 px-5">
        <span className="text-lg font-bold text-indigo-600">DevPulse</span>
      </div>

      <div className="flex-1 overflow-y-auto py-4 px-3">
        <NavLinks />
      </div>

      <div className="border-t border-gray-200 py-3">
        <AccountSwitcher />
      </div>
    </aside>
  )
}
