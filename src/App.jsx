import { useState } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import Dashboard from './pages/Dashboard'
import RawMaterials from './pages/RawMaterials'
import SizeYield from './pages/SizeYield'
import Process from './pages/Process'
import Solvent from './pages/Solvent'
import CostCalculation from './pages/CostCalculation'
import Inventory from './pages/Inventory'
import InventoryRegister from './pages/InventoryRegister'
import MonthlyReport from './pages/MonthlyReport'
import Products from './pages/Products'
import ProductDetail from './pages/ProductDetail'

function App() {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <BrowserRouter>
      <div className="flex flex-col min-h-screen bg-gray-50 md:flex-row">
        {/* モバイル用トップバー */}
        <header className="md:hidden bg-gray-900 text-white px-4 py-3 flex items-center gap-3 shrink-0">
          <button
            onClick={() => setMenuOpen(true)}
            className="text-2xl leading-none min-w-[44px] min-h-[44px] flex items-center justify-center"
            aria-label="メニューを開く"
          >
            ☰
          </button>
          <span className="text-sm font-bold">原価・在庫管理</span>
        </header>

        <Sidebar isOpen={menuOpen} onClose={() => setMenuOpen(false)} />

        <main className="flex-1 p-4 md:p-6 overflow-auto min-w-0">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/raw-materials" element={<RawMaterials />} />
            <Route path="/size-yield" element={<SizeYield />} />
            <Route path="/process" element={<Process />} />
            <Route path="/solvent" element={<Solvent />} />
            <Route path="/products" element={<Products />} />
            <Route path="/products/:code" element={<ProductDetail />} />
            <Route path="/cost-calculation" element={<CostCalculation />} />
            <Route path="/inventory" element={<Inventory />} />
            <Route path="/inventory-register" element={<InventoryRegister />} />
            <Route path="/monthly-report" element={<MonthlyReport />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}

export default App
