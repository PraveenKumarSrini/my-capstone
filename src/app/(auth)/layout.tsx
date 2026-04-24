export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-indigo-600">DevPulse</h1>
          <p className="mt-1 text-sm text-gray-500">Developer Analytics Dashboard</p>
        </div>
        <div className="rounded-xl bg-white px-8 py-10 shadow-sm ring-1 ring-gray-900/5">
          {children}
        </div>
      </div>
    </div>
  )
}
