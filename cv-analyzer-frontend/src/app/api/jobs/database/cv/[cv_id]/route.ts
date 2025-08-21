import { NextRequest, NextResponse } from 'next/server';

/**
 * Database CV Details API Route - Proxy to Backend
 * GET /api/jobs/database/cv/[cv_id]
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { cv_id: string } }
) {
  try {
    const { cv_id } = params;
    const backendUrl = process.env.BACKEND_URL || 'http://backend:8000';
    
    console.log('🔍 [DATABASE CV] Proxying to backend:', `${backendUrl}/database/cv/${cv_id}`);
    
    const response = await fetch(`${backendUrl}/api/database/cv/${cv_id}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.error('❌ [DATABASE CV] Backend error:', response.status, response.statusText);
      return NextResponse.json(
        { error: 'Backend database CV check failed', status: response.status },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log('✅ [DATABASE CV] Backend response received for CV:', cv_id);
    
    return NextResponse.json(data);
  } catch (error) {
    console.error('❌ [DATABASE CV] Request failed:', error);
    return NextResponse.json(
      { error: 'Failed to check CV in database', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
