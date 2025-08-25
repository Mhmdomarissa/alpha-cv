import { NextResponse } from 'next/server';
import { getApiBaseUrl } from '@/lib/config';

export async function GET() {
  try {
    const backendUrl = getApiBaseUrl('server');
    console.log('🔄 Proxying list-jds request to backend:', `${backendUrl}/api/jd/jds`);
    
    const response = await fetch(`${backendUrl}/api/jd/jds`, {
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
    console.log('✅ Successfully fetched JDs from backend:', data.jds?.length || 0, 'JDs');
    
    return NextResponse.json(data);
  } catch (error) {
    console.error('❌ Error proxying list-jds request:', error);
    return NextResponse.json(
      { error: 'Failed to connect to backend' },
      { status: 500 }
    );
  }
}