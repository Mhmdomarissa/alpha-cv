import { NextRequest, NextResponse } from 'next/server';

/**
 * Database Collections API Route - Proxy to Backend
 * GET /api/jobs/database/collections
 */
export async function GET(request: NextRequest) {
  try {
    const backendUrl = process.env.BACKEND_URL || 'http://backend:8000';
    
    console.log('🔍 [DATABASE COLLECTIONS] Proxying to backend:', `${backendUrl}/database/collections`);
    
    const response = await fetch(`${backendUrl}/api/database/collections`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.error('❌ [DATABASE COLLECTIONS] Backend error:', response.status, response.statusText);
      return NextResponse.json(
        { error: 'Backend database collections check failed', status: response.status },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log('✅ [DATABASE COLLECTIONS] Backend response received');
    
    return NextResponse.json(data);
  } catch (error) {
    console.error('❌ [DATABASE COLLECTIONS] Request failed:', error);
    return NextResponse.json(
      { error: 'Failed to check database collections', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
