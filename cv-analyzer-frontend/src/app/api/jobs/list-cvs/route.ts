import { NextResponse } from 'next/server';
import { getApiBaseUrl } from '@/lib/config';

export async function GET() {
  try {
    const backendUrl = getApiBaseUrl('server');
    console.log('🔄 Proxying list-cvs request to backend:', `${backendUrl}/api/jobs/list-cvs`);
    
    const response = await fetch(`${backendUrl}/api/jobs/list-cvs`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.error('❌ Backend responded with error:', response.status, response.statusText);
      return NextResponse.json(
        { error: 'Backend API error', status: response.status },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log('✅ Successfully fetched CVs from backend:', data.cvs?.length || 0, 'CVs');
    
    return NextResponse.json(data);
  } catch (error) {
    console.error('❌ Error proxying list-cvs request:', error);
    return NextResponse.json(
      { error: 'Failed to connect to backend' },
      { status: 500 }
    );
  }
}