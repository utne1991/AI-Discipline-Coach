import { useState } from 'react';
import { Activity, LogIn, ShieldCheck, CalendarCheck2 } from 'lucide-react';

interface AuthGateProps {
  heroImageUrl: string;
  onSignIn: () => Promise<void>;
  isSigningIn: boolean;
  errorMessage: string | null;
}

export function AuthGate({
  heroImageUrl,
  onSignIn,
  isSigningIn,
  errorMessage,
}: AuthGateProps) {
  const [imgFailed, setImgFailed] = useState(false);

  return (
    <div className="min-h-screen bg-[#F6F7F8] text-slate-900 flex flex-col justify-between">
      <header className="w-full max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between border-b border-slate-200/80 bg-white/80 backdrop-blur-md sticky top-0 z-20">
        <span className="text-base font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0">
          AI Discipline Coach
        </span>
        <span className="text-xs text-slate-500 whitespace-nowrap shrink-0">
          Kỷ luật · An toàn · Cá nhân hóa
        </span>
      </header>

      <main className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-12 flex items-center">
        <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-10 items-stretch">
          <div className="lg:col-span-7 relative rounded-3xl overflow-hidden bg-slate-900 min-h-[240px] sm:min-h-[340px] border border-slate-200">
            {!imgFailed ? (
              <img
                src={heroImageUrl}
                alt="Vận động viên chuẩn bị tập luyện buổi sáng"
                referrerPolicy="no-referrer"
                onError={() => setImgFailed(true)}
                className="w-full h-full object-cover absolute inset-0"
              />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-teal-950 to-slate-900 flex items-center justify-center">
                <Activity className="w-16 h-16 text-teal-400/50" />
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/35 to-transparent" />
            <div className="relative h-full p-6 sm:p-8 flex flex-col justify-end text-white">
              <p className="text-xs font-medium text-teal-300 tracking-wide mb-2">
                Huấn luyện viên thể chất cá nhân
              </p>
              <h1 className="text-2xl sm:text-4xl font-bold tracking-tight leading-tight text-balance">
                Xây nền kỷ luật Tuần 1, an toàn cho cơ thể bạn
              </h1>
              <p className="mt-3 text-sm sm:text-base text-slate-200 max-w-xl leading-relaxed">
                Lưu hồ sơ thể chất, thiết lập mục tiêu 4–12 tuần và nhận lịch tập Tuần 1 được điều chỉnh theo độ tuổi và giới hạn sức khỏe.
              </p>
            </div>
          </div>

          <div className="lg:col-span-5 bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-8 flex flex-col justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-900 tracking-tight">
                Bắt đầu lộ trình của bạn
              </h2>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                Đăng nhập bằng Google để đồng bộ hồ sơ, mục tiêu và lịch tập tuần an toàn mỗi khi mở lại ứng dụng.
              </p>

              <div className="mt-6 space-y-4 border-t border-slate-100 pt-5">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center shrink-0">
                    <Activity className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">01. Hồ sơ & Giới hạn sức khỏe</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Ghi nhận thể trạng, dụng cụ và các vùng cần bảo vệ.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center shrink-0">
                    <CalendarCheck2 className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">02. Mục tiêu 4–12 tuần</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Chọn Chạy bộ, Tập tại nhà hoặc Gym với lộ trình rõ ràng.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">03. Chế độ thận trọng tự động</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Tự động giảm tải và cảnh báo an toàn khi có giới hạn sức khỏe hoặc tuổi &lt;16 / &gt;60.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-8">
              {errorMessage && (
                <div
                  role="alert"
                  className="mb-4 rounded-2xl bg-rose-50 border border-rose-200 px-4 py-3 text-xs text-rose-800"
                >
                  {errorMessage}
                </div>
              )}

              <button
                type="button"
                onClick={onSignIn}
                disabled={isSigningIn}
                className="w-full min-h-[48px] px-5 py-3 rounded-2xl bg-teal-700 hover:bg-teal-800 active:scale-[0.99] text-white font-semibold text-sm flex items-center justify-center gap-2.5 transition-all disabled:opacity-60 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
              >
                <LogIn className="w-4 h-4" />
                <span>{isSigningIn ? 'Đang kết nối Google...' : 'Đăng nhập bằng Google'}</span>
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
