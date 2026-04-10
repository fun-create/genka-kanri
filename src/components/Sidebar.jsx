import { NavLink } from 'react-router-dom'

const navItems = [
  { to: '/', label: 'ダッシュボード', icon: '🏠' },
  { to: '/products', label: '商品管理', icon: '🛍️' },
  { to: '/cost-calculation', label: '原価計算', icon: '💴' },
  { to: '/inventory', label: '在庫一覧', icon: '📋' },
  { to: '/inventory-register', label: '在庫登録', icon: '✏️' },
  { to: '/monthly-report', label: '月次レポート', icon: '📊' },
  { to: '/cost-validation', label: '原価検証', icon: '✅' },
  { to: '/price-simulation', label: '売価シミュレーション', icon: '💹' },
  { label: '─', divider: true },
  { to: '/raw-materials', label: '原材料マスタ', icon: '📦' },
  { to: '/size-yield', label: 'サイズ歩留まり', icon: '📐' },
  { to: '/process', label: '工程マスタ', icon: '⚙️' },
  { to: '/solvent', label: '溶剤マスタ', icon: '🧪' },
]

export default function Sidebar({ isOpen, onClose }) {
  return (
    <>
      {/* モバイル用オーバーレイ */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={onClose}
        />
      )}

      {/* サイドバー本体 */}
      <aside
        className={`
          fixed top-0 left-0 z-50 h-full w-64
          bg-gray-900 text-white flex flex-col
          transition-transform duration-200
          md:relative md:w-56 md:h-auto md:min-h-screen md:translate-x-0
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        <div className="px-4 py-5 border-b border-gray-700 flex items-center justify-between shrink-0">
          <div>
            <h1 className="text-sm font-bold text-gray-100">原価・在庫管理</h1>
            <p className="text-xs text-gray-400 mt-0.5">Management System</p>
          </div>
          <button
            onClick={onClose}
            className="md:hidden text-gray-400 hover:text-white text-2xl leading-none min-w-[44px] min-h-[44px] flex items-center justify-center"
            aria-label="メニューを閉じる"
          >
            ×
          </button>
        </div>

        <nav className="flex-1 py-4 overflow-y-auto">
          {navItems.map((item, i) =>
            item.divider ? (
              <div key={i} className="border-t border-gray-700 mx-4 my-2" />
            ) : (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                onClick={onClose}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-3 text-sm transition-colors min-h-[44px] ${
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
    </>
  )
}
