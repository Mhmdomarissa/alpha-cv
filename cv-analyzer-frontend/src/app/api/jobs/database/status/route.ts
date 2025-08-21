import { NextRequest, NextResponse } from 'next/server';

/**
 * Database Status API Route - Proxy to Backend
 * GET /api/jobs/database/status
 */
export async function GET(request: NextRequest) {
  try {
    const backendUrl = process.env.BACKEND_URL || 'http://backend:8000';
    
    console.log('🔍 [DATABASE STATUS] Proxying to backend:', `${backendUrl}/database/status`);
    
    const response = await fetch(`${backendUrl}/api/database/status`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.error('❌ [DATABASE STATUS] Backend error:', response.status, response.statusText);
      return NextResponse.json(
        { error: 'Backend database status check failed', status: response.status },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log('✅ [DATABASE STATUS] Backend response received');
    
    return NextResponse.json(data);
  } catch (error) {
    console.error('❌ [DATABASE STATUS] Request failed:', error);
    return NextResponse.json(
      { error: 'Failed to check database status', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
