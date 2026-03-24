import { NavLink } from 'react-router-dom'

const navItems = [
  { to: '/', label: 'ダッシュボード', icon: '🏠' },
  { to: '/products', label: '商品管理', icon: '🛍️' },
  { to: '/cost-calculation', label: '原価計算', icon: '💴' },
  { to: '/inventory', label: '在庫一覧', icon: '📋' },
  { to: '/inventory-register', label: '在庫登録', icon: '✏️' },
  { to: '/monthly-report', label: '月次レポート', icon: '📊' },
  { label: '─', divider: true },
  { to: '/raw-materials', label: '原材料マスタ', icon: '📦' },
  { to: '/size-yield', label: 'サイズ歩留まり', icon: '📐' },
  { to: '/process', label: '工程マスタ', icon: '⚙️' },
  { to: '/solvent', label: '溶剤マスタ', icon: '🧪' },
]

export default function Sidebar() {
  return (
    <aside className="w-56 min-h-screen bg-gray-900 text-white flex flex-col">
      <div className="px-4 py-5 border-b border-gray-700">
        <h1 className="text-sm font-bold text-gray-100">原価・在庫管理</h1>
        <p className="text-xs text-gray-400 mt-0.5">Management System</p>
      </div>
      <nav className="flex-1 py-4">
        {navItems.map((item, i) =>
          item.divider ? (
            <div key={i} className="border-t border-gray-700 mx-4 my-2" />
          ) : (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                  isActive
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                }`
              }
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          )
        )}
      </nav>
    </aside>
  )
}
