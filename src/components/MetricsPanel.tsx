'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts'
import {
  TrendingUp,
  CheckCircle2,
  Clock,
  Zap,
  ChevronDown,
  BarChart3,
  PieChartIcon,
  Activity,
} from 'lucide-react'

// Mock data for charts
const activityData = [
  { day: 'Mon', tasks: 4 },
  { day: 'Tue', tasks: 7 },
  { day: 'Wed', tasks: 5 },
  { day: 'Thu', tasks: 9 },
  { day: 'Fri', tasks: 12 },
  { day: 'Sat', tasks: 8 },
  { day: 'Sun', tasks: 6 },
]

const agentPerformance = [
  { name: 'Spark', completed: 7, color: '#f97316' },
  { name: 'Scout', completed: 5, color: '#3b82f6' },
  { name: 'Pixel', completed: 4, color: '#a855f7' },
  { name: 'Critic', completed: 6, color: '#22c55e' },
  { name: 'Forge', completed: 3, color: '#eab308' },
]

const statusDistribution = [
  { name: 'Completed', value: 25, color: '#22c55e' },
  { name: 'In Progress', value: 8, color: '#3b82f6' },
  { name: 'Pending', value: 5, color: '#6b7280' },
  { name: 'Blocked', value: 2, color: '#ef4444' },
]

const stats = [
  {
    label: 'Total Tasks',
    value: '40',
    change: '+12%',
    positive: true,
    icon: CheckCircle2,
  },
  {
    label: 'Completed',
    value: '25',
    change: '+8',
    positive: true,
    icon: TrendingUp,
  },
  {
    label: 'Avg. Time',
    value: '2.4h',
    change: '-15%',
    positive: true,
    icon: Clock,
  },
  {
    label: 'Streak',
    value: '7',
    change: 'days',
    positive: true,
    icon: Zap,
  },
]

type ChartType = 'activity' | 'agents' | 'status'

export function MetricsPanel() {
  const [isExpanded, setIsExpanded] = useState(true)
  const [activeChart, setActiveChart] = useState<ChartType>('activity')

  const chartTabs: { id: ChartType; label: string; icon: React.ReactNode }[] = [
    { id: 'activity', label: 'Activity', icon: <Activity className="w-4 h-4" /> },
    { id: 'agents', label: 'Agents', icon: <BarChart3 className="w-4 h-4" /> },
    { id: 'status', label: 'Status', icon: <PieChartIcon className="w-4 h-4" /> },
  ]

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, rgba(33,34,37,0.8), rgba(24,25,27,0.9))',
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(255,255,255,0.06)',
        boxShadow: '0 0 0 1px rgba(255,255,255,0.03), 0 2px 4px rgba(0,0,0,0.3), 0 8px 24px rgba(0,0,0,0.4)',
      }}
    >
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-6 py-4 flex items-center justify-between hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex items-center gap-3">
          <BarChart3 className="w-5 h-5 text-[#8e4ec6]" />
          <h2 className="font-semibold text-white">Metrics & Performance</h2>
        </div>
        <motion.div
          animate={{ rotate: isExpanded ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronDown className="w-5 h-5 text-[#697177]" />
        </motion.div>
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {/* Stats Row */}
            <div className="px-6 pb-4 grid grid-cols-2 md:grid-cols-4 gap-4">
              {stats.map((stat, index) => (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.04] hover:border-white/[0.08] transition-colors"
                >
                  <div className="flex items-center justify-between mb-2">
                    <stat.icon className="w-4 h-4 text-[#697177]" />
                    <span
                      className={`text-xs font-medium ${
                        stat.positive ? 'text-[#46a758]' : 'text-[#e54d2e]'
                      }`}
                    >
                      {stat.change}
                    </span>
                  </div>
                  <p className="text-2xl font-bold text-white">{stat.value}</p>
                  <p className="text-xs text-[#697177] mt-1">{stat.label}</p>
                </motion.div>
              ))}
            </div>

            {/* Chart Tabs */}
            <div className="px-6 pb-2 flex gap-1">
              {chartTabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveChart(tab.id)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                    activeChart === tab.id
                      ? 'bg-white/[0.08] text-white'
                      : 'text-[#697177] hover:text-[#b0b4ba] hover:bg-white/[0.03]'
                  }`}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Charts */}
            <div className="px-6 pb-6">
              <AnimatePresence mode="wait">
                {activeChart === 'activity' && (
                  <motion.div
                    key="activity"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    className="h-[200px]"
                  >
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={activityData}>
                        <defs>
                          <linearGradient id="taskGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#8e4ec6" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#8e4ec6" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#313538" vertical={false} />
                        <XAxis
                          dataKey="day"
                          tick={{ fill: '#697177', fontSize: 12 }}
                          axisLine={{ stroke: '#313538' }}
                          tickLine={false}
                        />
                        <YAxis
                          tick={{ fill: '#697177', fontSize: 12 }}
                          axisLine={{ stroke: '#313538' }}
                          tickLine={false}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#18191b',
                            border: '1px solid #313538',
                            borderRadius: '8px',
                            color: '#edeef0',
                          }}
                        />
                        <Area
                          type="monotone"
                          dataKey="tasks"
                          stroke="#8e4ec6"
                          strokeWidth={2}
                          fill="url(#taskGradient)"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </motion.div>
                )}

                {activeChart === 'agents' && (
                  <motion.div
                    key="agents"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    className="h-[200px]"
                  >
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={agentPerformance} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke="#313538" horizontal={false} />
                        <XAxis
                          type="number"
                          tick={{ fill: '#697177', fontSize: 12 }}
                          axisLine={{ stroke: '#313538' }}
                          tickLine={false}
                        />
                        <YAxis
                          type="category"
                          dataKey="name"
                          tick={{ fill: '#b0b4ba', fontSize: 12 }}
                          axisLine={false}
                          tickLine={false}
                          width={60}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#18191b',
                            border: '1px solid #313538',
                            borderRadius: '8px',
                            color: '#edeef0',
                          }}
                        />
                        <Bar dataKey="completed" radius={[0, 4, 4, 0]}>
                          {agentPerformance.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </motion.div>
                )}

                {activeChart === 'status' && (
                  <motion.div
                    key="status"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    className="h-[200px] flex items-center justify-center"
                  >
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={statusDistribution}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={80}
                          paddingAngle={4}
                          dataKey="value"
                        >
                          {statusDistribution.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#18191b',
                            border: '1px solid #313538',
                            borderRadius: '8px',
                            color: '#edeef0',
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute flex flex-col gap-2">
                      {statusDistribution.map((item) => (
                        <div key={item.name} className="flex items-center gap-2 text-xs">
                          <div
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: item.color }}
                          />
                          <span className="text-[#b0b4ba]">{item.name}</span>
                          <span className="text-white font-medium">{item.value}</span>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
