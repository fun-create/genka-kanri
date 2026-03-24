import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Link } from 'react-router-dom'

export default function Dashboard() {
  const [stats, setStats] = useState({
    rawMaterialCount: 0,
    lowStockCount: 0,
    productCount: 0,
    solventPrice: 0,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchStats() {
      const [rawRes, productRes, solventRes] = await Promise.all([
        supabase.from('T_原材料マスタ').select('原材料コード, 現在庫, 発注点'),
        supabase.from('T_商品マスタ').select('商品コード', { count: 'exact', head: true }),
        supabase.from('T_溶剤マスタ').select('最新単価').limit(1).single(),
      ])

      const rawData = rawRes.data || []
      setStats({
        rawMaterialCount: rawData.length,
        lowStockCount: rawData.filter((r) => r['現在庫'] <= r['発注点']).length,
        productCount: productRes.count || 0,
        solventPrice: solventRes.data?.['最新単価'] ?? 0,
      })
      setLoading(false)
    }
    fetchStats()
  }, [])

  const cards = [
    { label: '原材料種類数', value: stats.rawMaterialCount, unit: '種', color: 'bg-blue-50 border-blue-200', link: '/raw-materials' },
    { label: '発注点以下の在庫', value: stats.lowStockCount, unit: '件', color: 'bg-red-50 border-red-200', link: '/inventory' },
    { label: '商品マスタ件数', value: stats.productCount, unit: '件', color: 'bg-green-50 border-green-200', link: '/cost-calculation' },
    { label: '溶剤最新単価', value: stats.solventPrice.toLocaleString(), unit: '円', color: 'bg-yellow-50 border-yellow-200', link: '/solvent' },
  ]

  return (
    <div>
      <h2 className="text-xl font-bold text-gray-800 mb-6">ダッシュボード</h2>
      {loading ? (
        <p className="text-gray-500">読み込み中...</p>
      ) : (
        <div className="grid grid-cols-2 gap-4 mb-8">
          {cards.map((card) => (
            <Link
              key={card.label}
              to={card.link}
              className={`border rounded-lg p-5 ${card.color} hover:opacity-80 transition-opacity`}
            >
              <p className="text-sm text-gray-500 mb-1">{card.label}</p>
              <p className="text-3xl font-bold text-gray-800">
                {card.value}
                <span className="text-base font-normal text-gray-500 ml-1">{card.unit}</span>
              </p>
            </Link>
          ))}
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-lg p-5">
        <h3 className="font-semibold text-gray-700 mb-3">クイックリンク</h3>
        <div className="grid grid-cols-3 gap-2">
          {[
            { to: '/inventory-register', label: '在庫入庫登録' },
            { to: '/cost-calculation', label: '原価計算' },
            { to: '/monthly-report', label: '月次レポート' },
          ].map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className="text-center py-2 px-3 bg-gray-100 hover:bg-gray-200 rounded text-sm text-gray-700 transition-colors"
            >
              {link.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
