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
  return (
    <BrowserRouter>
      <div className="flex min-h-screen bg-gray-50">
        <Sidebar />
        <main className="flex-1 p-6 overflow-auto">
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
