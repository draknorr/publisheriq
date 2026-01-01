/**
 * Test endpoint for Cube.dev integration
 * GET /api/cube-test - Tests the Cube.dev connection and returns sample data
 */

import { NextResponse } from 'next/server';
import { executeCubeQuery, isCubeAvailable } from '@/lib/cube-executor';

export async function GET() {
  try {
    // Check if Cube.dev is available
    const available = await isCubeAvailable();

    if (!available) {
      return NextResponse.json({
        status: 'error',
        message: 'Cube.dev is not available. Check CUBE_API_URL.',
      }, { status: 503 });
    }

    // Run a simple test query
    const result = await executeCubeQuery({
      cube: 'Discovery',
      dimensions: ['Discovery.name', 'Discovery.appid', 'Discovery.positivePercentage'],
      measures: ['Discovery.count'],
      filters: [
        { member: 'Discovery.positivePercentage', operator: 'gte', values: [90] }
      ],
      order: { 'Discovery.totalReviews': 'desc' },
      limit: 5,
    });

    return NextResponse.json({
      status: 'success',
      message: 'Cube.dev is working!',
      cubeUrl: process.env.CUBE_API_URL,
      sampleQuery: 'Top 5 highly rated games',
      result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({
      status: 'error',
      message,
    }, { status: 500 });
  }
}
