'use client';

import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Brain, Search, Database, Lightbulb, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { ThinkingStep } from '@/types/chat';
import ReactMarkdown from 'react-markdown';

interface AdvancedThinkingVisualizationProps {
  thinkingSteps: ThinkingStep[];
  isProcessing?: boolean;
  currentStep?: string;
}

const stepIcons = {
  'analyze_query': Brain,
  'planning': Lightbulb,
  'knowledge_base': Database,
  'web_search': Search,
  'synthesis': CheckCircle,
  'response_generation': Brain,
};

const stepColors = {
  'analyze_query': 'bg-blue-100 text-blue-700 border-blue-200',
  'planning': 'bg-purple-100 text-purple-700 border-purple-200',
  'knowledge_base': 'bg-green-100 text-green-700 border-green-200',
  'web_search': 'bg-orange-100 text-orange-700 border-orange-200',
  'synthesis': 'bg-indigo-100 text-indigo-700 border-indigo-200',
  'response_generation': 'bg-pink-100 text-pink-700 border-pink-200',
};

const stepTitles = {
  'analyze_query': 'Query Analysis',
  'planning': 'Approach Planning',
  'knowledge_base': 'Knowledge Base Search',
  'web_search': 'Web Search',
  'synthesis': 'Information Synthesis',
  'response_generation': 'Response Generation',
};

export default function AdvancedThinkingVisualization({
  thinkingSteps,
  isProcessing = false,
  currentStep
}: AdvancedThinkingVisualizationProps) {
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set());
  const [animatingSteps, setAnimatingSteps] = useState<Set<string>>(new Set());

  // Auto-expand new steps and add animation
  React.useEffect(() => {
    if (thinkingSteps.length > 0) {
      const latestStep = thinkingSteps[thinkingSteps.length - 1];

      // Auto-expand the latest step
      setExpandedSteps(prev => new Set([...prev, latestStep.id]));

      // Add animation for new step
      setAnimatingSteps(prev => new Set([...prev, latestStep.id]));

      // Remove animation after a delay
      setTimeout(() => {
        setAnimatingSteps(prev => {
          const newSet = new Set(prev);
          newSet.delete(latestStep.id);
          return newSet;
        });
      }, 1000);
    }
  }, [thinkingSteps.length]);

  const toggleStep = (stepId: string) => {
    const newExpanded = new Set(expandedSteps);
    if (newExpanded.has(stepId)) {
      newExpanded.delete(stepId);
    } else {
      newExpanded.add(stepId);
    }
    setExpandedSteps(newExpanded);
  };

  const getStepStatus = (step: ThinkingStep) => {
    if (isProcessing && currentStep === step.stepType) {
      return 'processing';
    }
    if (step.duration !== undefined) {
      return 'completed';
    }
    return 'pending';
  };

  const formatDuration = (duration?: number) => {
    if (!duration) return '';
    return `${(duration / 1000).toFixed(1)}s`;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <Brain className="w-5 h-5 text-blue-600" />
        <h3 className="text-lg font-semibold text-gray-900">Advanced Reasoning Process</h3>
        {isProcessing && (
          <div className="flex items-center gap-2 text-sm text-blue-600">
            <Clock className="w-4 h-4 animate-spin" />
            <span>Processing...</span>
          </div>
        )}
      </div>

      <div className="space-y-3">
        {thinkingSteps.map((step, index) => {
          const Icon = stepIcons[step.stepType as keyof typeof stepIcons] || Brain;
          const colorClass = stepColors[step.stepType as keyof typeof stepColors] || 'bg-gray-100 text-gray-700 border-gray-200';
          const isExpanded = expandedSteps.has(step.id);
          const isAnimating = animatingSteps.has(step.id);
          const status = getStepStatus(step);

          return (
            <div key={step.id} className={`relative ${isAnimating ? 'animate-pulse' : ''}`}>
              {/* Connection line to next step */}
              {index < thinkingSteps.length - 1 && (
                <div className="absolute left-6 top-12 w-0.5 h-8 bg-gray-200 z-0"></div>
              )}

              <div className={`relative z-0 border rounded-lg transition-all duration-500 hover:shadow-md ${
                status === 'completed' ? 'bg-white border-gray-200' :
                status === 'processing' ? 'bg-blue-50 border-blue-300 shadow-md' :
                'bg-gray-50 border-gray-100'
              } ${isAnimating ? 'scale-105 shadow-lg' : ''}`}>
                <div 
                  className="flex items-center gap-3 p-4 cursor-pointer"
                  onClick={() => toggleStep(step.id)}
                >
                  {/* Step Icon */}
                  <div className={`flex items-center justify-center w-12 h-12 rounded-full border-2 ${colorClass}`}>
                    {status === 'processing' ? (
                      <Clock className="w-5 h-5 animate-spin" />
                    ) : status === 'completed' ? (
                      <Icon className="w-5 h-5" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-gray-400" />
                    )}
                  </div>

                  {/* Step Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium text-gray-900">
                        {step.title || stepTitles[step.stepType as keyof typeof stepTitles] || step.stepType}
                      </h4>
                      {step.duration && (
                        <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                          {formatDuration(step.duration)}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                      {step.content.substring(0, 120)}
                      {step.content.length > 120 ? '...' : ''}
                    </p>
                  </div>

                  {/* Expand/Collapse Icon */}
                  <div className="flex-shrink-0">
                    {isExpanded ? (
                      <ChevronDown className="w-5 h-5 text-gray-400" />
                    ) : (
                      <ChevronRight className="w-5 h-5 text-gray-400" />
                    )}
                  </div>
                </div>

                {/* Expanded Content */}
                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-gray-100">
                    <div className="mt-3 space-y-3">
                      <div className="prose prose-sm max-w-none text-gray-700 bg-gray-50 p-3 rounded-md">
                        <ReactMarkdown>
                          {step.content}
                        </ReactMarkdown>
                      </div>
                      
                      {/* Step Metadata */}
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        <span>Step {index + 1} of {thinkingSteps.length}</span>
                        <span>Type: {step.stepType}</span>
                        {step.timestamp && (
                          <span>
                            {new Date(step.timestamp).toLocaleTimeString()}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Processing Indicator */}
      {isProcessing && thinkingSteps.length === 0 && (
        <div className="flex items-center justify-center py-8">
          <div className="flex items-center gap-3 text-blue-600">
            <Clock className="w-6 h-6 animate-spin" />
            <span className="text-lg">Initializing advanced reasoning...</span>
          </div>
        </div>
      )}

      {/* Summary */}
      {thinkingSteps.length > 0 && !isProcessing && (
        <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center gap-2 text-green-800">
            <CheckCircle className="w-5 h-5" />
            <span className="font-medium">Reasoning Complete</span>
          </div>
          <p className="text-sm text-green-700 mt-1">
            Processed {thinkingSteps.length} reasoning steps in{' '}
            {formatDuration(thinkingSteps.reduce((total, step) => total + (step.duration || 0), 0))}
          </p>
        </div>
      )}
    </div>
  );
}
