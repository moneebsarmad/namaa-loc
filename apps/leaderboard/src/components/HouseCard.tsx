interface House {
  rank: number;
  name: string;
  virtue: string;
  description: string;
  points: number;
  color: string;
  bgColor: string;
  logo?: string | null;
  todayPoints?: number;
}

interface RecentAchievement {
  studentName: string;
  points: number;
  domain: string;
}

interface HouseCardProps {
  house: House;
  maxPoints: number;
  recentAchievement?: RecentAchievement | null;
}

export default function HouseCard({ house, maxPoints, recentAchievement }: HouseCardProps) {
  const isFirstPlace = house.rank === 1;
  const progressPercent = maxPoints > 0 ? Math.min(100, (house.points / maxPoints) * 100) : 0;
  const displayName = house.name.replace("House of ", "");

  return (
    <div
      className={`relative rounded-2xl overflow-hidden shadow-sm bg-white ${
        isFirstPlace ? "ring-2 ring-[#2D5016] ring-offset-2" : ""
      }`}
    >
      <div className="p-5">
        <div className="flex items-center gap-4">
          {/* Rank Badge */}
          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
              isFirstPlace
                ? "text-white"
                : "bg-white border-2 text-[#B8860B]"
            }`}
            style={{
              backgroundColor: isFirstPlace ? house.color : "white",
              borderColor: isFirstPlace ? house.color : "#B8860B",
            }}
          >
            {house.rank}
          </div>

          {/* House Info */}
          <div className="flex-1 min-w-0">
            <h2
              className="text-lg font-bold truncate"
              style={{
                color: house.color,
                fontFamily: "var(--font-poppins), 'Poppins', sans-serif",
              }}
            >
              {displayName}
            </h2>

            {/* Progress Bar */}
            <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden mt-2">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${progressPercent}%`,
                  backgroundColor: house.color,
                }}
              />
            </div>
          </div>

          {/* Points & Today */}
          <div className="text-right flex-shrink-0">
            <p
              className="text-2xl font-bold"
              style={{
                color: house.color,
                fontFamily: "var(--font-poppins), 'Poppins', sans-serif",
              }}
            >
              {house.points.toLocaleString()}
            </p>
            {(house.todayPoints ?? 0) > 0 && (
              <p
                className="text-xs font-medium text-[#2D5016]"
                style={{ fontFamily: "var(--font-source-sans), 'Source Sans 3', sans-serif" }}
              >
                +{house.todayPoints} today
              </p>
            )}
          </div>
        </div>

        {/* Recent Achievement (only for first place) */}
        {isFirstPlace && recentAchievement && (
          <div
            className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-2 text-sm animate-pulse"
            style={{
              color: house.color,
              fontFamily: "var(--font-source-sans), 'Source Sans 3', sans-serif",
            }}
          >
            <span className="text-[#B8860B]">&#10022;</span>
            <span>
              {recentAchievement.studentName} just earned +{recentAchievement.points} for {recentAchievement.domain}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
