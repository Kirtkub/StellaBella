import { NextRequest, NextResponse } from 'next/server';
import { 
  getTotalStats, 
  getStatsForPeriod, 
  getAllUsers, 
  isConfigured,
  RedisNotConfiguredError 
} from '@/lib/redis';

export async function GET(request: NextRequest) {
  try {
    if (!isConfigured()) {
      return NextResponse.json({ 
        error: 'Database not configured',
        message: 'Please configure KV_REST_API_URL and KV_REST_API_TOKEN environment variables.',
        configured: false,
      }, { status: 503 });
    }

    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '7', 10);
    
    const [totalStats, periodStats, users] = await Promise.all([
      getTotalStats(),
      getStatsForPeriod(days),
      getAllUsers(),
    ]);
    
    const previousPeriodStats = await getStatsForPeriod(days * 2);
    const previousStats = previousPeriodStats.slice(0, days);
    
    const currentNewUsers = periodStats.reduce((sum, s) => sum + s.newUsers, 0);
    const currentInteractions = periodStats.reduce((sum, s) => sum + s.interactions, 0);
    const currentStars = periodStats.reduce((sum, s) => sum + s.starsEarned, 0);
    
    const previousNewUsers = previousStats.reduce((sum, s) => sum + s.newUsers, 0);
    const previousInteractions = previousStats.reduce((sum, s) => sum + s.interactions, 0);
    const previousStars = previousStats.reduce((sum, s) => sum + s.starsEarned, 0);
    
    const calculateChange = (current: number, previous: number): number => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return Math.round(((current - previous) / previous) * 100);
    };
    
    return NextResponse.json({
      configured: true,
      total: totalStats,
      period: {
        days,
        newUsers: currentNewUsers,
        interactions: currentInteractions,
        starsEarned: currentStars,
        changes: {
          newUsers: calculateChange(currentNewUsers, previousNewUsers),
          interactions: calculateChange(currentInteractions, previousInteractions),
          starsEarned: calculateChange(currentStars, previousStars),
        },
      },
      dailyStats: periodStats,
      users: users.sort((a, b) => 
        new Date(b.lastActiveAt).getTime() - new Date(a.lastActiveAt).getTime()
      ),
    });
  } catch (error) {
    console.error('Stats API error:', error);
    
    if (error instanceof RedisNotConfiguredError) {
      return NextResponse.json({ 
        error: 'Database not configured',
        message: error.message,
        configured: false,
      }, { status: 503 });
    }
    
    return NextResponse.json({ 
      error: 'Failed to fetch stats',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
