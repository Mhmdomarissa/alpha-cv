import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrl } from '@/lib/config';

export async function POST(request: NextRequest) {
  try {
    console.log('📋 [JD UPLOAD] Starting JD file upload and standardization...');
    
    // Get form data from the request
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      console.error('❌ [JD UPLOAD] No file provided');
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }
    
    console.log('📋 [JD UPLOAD] File details:', {
      name: file.name,
      size: file.size,
      type: file.type
    });
    
    // Create FormData for backend request
    const backendFormData = new FormData();
    backendFormData.append('file', file);
    
    const backendUrl = getApiBaseUrl('server');
    const targetUrl = `${backendUrl}/api/jobs/standardize-jd`;
    
    console.log('📋 [JD UPLOAD] Calling backend:', targetUrl);
    
    // Forward request to backend
    const response = await fetch(targetUrl, {
      method: 'POST',
      body: backendFormData,
      // Don't set Content-Type header - let fetch handle it for FormData
      signal: AbortSignal.timeout(60000), // 60 second timeout for file processing
    });
    
    if (!response.ok) {
      const errorText = await response.text().catch(() => 'No error details');
      console.error('❌ [JD UPLOAD] Backend response failed:', {
        status: response.status,
        statusText: response.statusText,
        error: errorText,
        url: targetUrl
      });
      
      return NextResponse.json(
        { 
          error: `JD upload failed: ${response.status} - ${response.statusText}`,
          details: errorText
        },
        { status: response.status }
      );
    }
    
    const data = await response.json();
    console.log('✅ [JD UPLOAD] Backend processing completed successfully');
    console.log('📋 [JD UPLOAD] Response preview:', {
      hasStandardizedData: !!data.standardized_data,
      jdId: data.jd_id,
      filename: data.filename
    });
    
    return NextResponse.json(data);
    
  } catch (error) {
    console.error('❌ [JD UPLOAD] Unexpected error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return NextResponse.json(
      { 
        error: 'JD upload processing failed',
        message: errorMessage
      },
      { status: 500 }
    );
  }
} 