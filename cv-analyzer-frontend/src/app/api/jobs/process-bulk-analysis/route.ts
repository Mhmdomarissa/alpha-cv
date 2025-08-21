import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrl } from '@/lib/config';

export async function POST(request: NextRequest) {
  try {
    console.log('🔍 [BULK ANALYSIS] Starting bulk CV-JD analysis request...');
    
    // Get JSON data from the request
    const requestData = await request.json();
    console.log('🔍 [BULK ANALYSIS] Request data:', {
      hasJdText: !!requestData.jd_text,
      cvCount: requestData.cv_texts?.length || 0,
      jdLength: requestData.jd_text?.length || 0
    });
    
    if (!requestData.jd_text || !requestData.cv_texts || !Array.isArray(requestData.cv_texts)) {
      console.error('❌ [BULK ANALYSIS] Missing required data');
      return NextResponse.json(
        { error: 'jd_text and cv_texts array are required' },
        { status: 400 }
      );
    }
    
    const backendUrl = getApiBaseUrl('server');
    
    // Process each CV individually since backend doesn't have bulk endpoint yet
    const results = [];
    const startTime = Date.now();
    
    for (let i = 0; i < requestData.cv_texts.length; i++) {
      const cvText = requestData.cv_texts[i];
      const analysisUrl = `${backendUrl}/api/jobs/standardize-and-match-text`;
      
      console.log(`🔍 [BULK ANALYSIS] Processing CV ${i + 1}/${requestData.cv_texts.length}`);
      
      try {
        const backendResponse = await fetch(analysisUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            jd_text: requestData.jd_text,
            cv_text: cvText,
            jd_filename: requestData.jd_filename || `jd_${i + 1}.txt`,
            cv_filename: requestData.cv_filenames?.[i] || `cv_${i + 1}.txt`
          }),
          signal: AbortSignal.timeout(120000), // Increase to 2 minutes per CV
        });
        
        if (backendResponse.ok) {
          const analysisData = await backendResponse.json();
          results.push({
            cv_index: i,
            success: true,
            data: analysisData
          });
        } else {
          const errorText = await backendResponse.text().catch(() => 'No error details');
          console.error(`❌ [BULK ANALYSIS] CV ${i + 1} failed:`, backendResponse.status, errorText);
          results.push({
            cv_index: i,
            success: false,
            error: `Analysis failed: ${backendResponse.status} - ${backendResponse.statusText}`,
            details: errorText
          });
        }
      } catch (error) {
        console.error(`❌ [BULK ANALYSIS] CV ${i + 1} error:`, error);
        results.push({
          cv_index: i,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          details: 'Request failed or timed out'
        });
      }
    }
    
    const responseTime = Date.now() - startTime;
    const successCount = results.filter(r => r.success).length;
    
    console.log(`✅ [BULK ANALYSIS] Completed: ${successCount}/${results.length} successful in ${responseTime}ms`);
    
    return NextResponse.json({
      status: 'completed',
      total_cvs: results.length,
      successful_analyses: successCount,
      failed_analyses: results.length - successCount,
      processing_time_ms: responseTime,
      results: results,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ [BULK ANALYSIS] Unexpected error:', error);
    
    let errorMessage = 'Bulk analysis processing failed';
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    
    return NextResponse.json(
      { 
        error: 'Bulk CV-JD analysis failed',
        message: errorMessage,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}
