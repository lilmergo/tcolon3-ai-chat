import { NextRequest, NextResponse } from 'next/server';
import { KnowledgeBaseManager } from '@/lib/knowledgeBase';
import { getUserFromRequest } from '@/lib/firebase-admin';

export async function POST(request: NextRequest) {
  try {
    // Authenticate user using Firebase Admin SDK
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const formData = await request.formData();

    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const kbManager = new KnowledgeBaseManager(user.uid);
    const documentId = await kbManager.uploadDocument(file);

    return NextResponse.json({ 
      success: true, 
      documentId,
      message: 'Document uploaded and processing started'
    });

  } catch (error) {
    console.error('Knowledge base upload error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Upload failed' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    // Authenticate user using Firebase Admin SDK
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const kbManager = new KnowledgeBaseManager(user.uid);
    const documents = await kbManager.getUserDocuments();

    return NextResponse.json({ documents });

  } catch (error) {
    console.error('Knowledge base fetch error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Fetch failed' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    // Authenticate user using Firebase Admin SDK
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const documentId = searchParams.get('documentId');

    if (!documentId) {
      return NextResponse.json({ error: 'Document ID required' }, { status: 400 });
    }

    const kbManager = new KnowledgeBaseManager(user.uid);
    await kbManager.deleteDocument(documentId);

    return NextResponse.json({ 
      success: true,
      message: 'Document deleted successfully'
    });

  } catch (error) {
    console.error('Knowledge base delete error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Delete failed' },
      { status: 500 }
    );
  }
}
