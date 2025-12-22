// src/utils/clinicalAnalysis.js

/**
 * Clinical Vitals Analysis Utility
 * Provides medical-grade analysis for patient vital signs
 */

// ==================== CLINICAL RANGES ====================

export const CLINICAL_RANGES = {
  heartRate: {
    critical_low: { min: 0, max: 40, label: "Critical Bradycardia", color: "#DC2626", severity: "critical" },
    bradycardia: { min: 40, max: 60, label: "Bradycardia", color: "#3B82F6", severity: "low" },
    normal: { min: 60, max: 100, label: "Normal", color: "#10B981", severity: "normal" },
    tachycardia: { min: 100, max: 120, label: "Tachycardia", color: "#F59E0B", severity: "high" },
    critical_high: { min: 120, max: 300, label: "Critical Tachycardia", color: "#DC2626", severity: "critical" }
  },
  respirationRate: {
    critical_low: { min: 0, max: 8, label: "Critical Low", color: "#DC2626", severity: "critical" },
    bradypnea: { min: 8, max: 12, label: "Bradypnea", color: "#3B82F6", severity: "low" },
    normal: { min: 12, max: 20, label: "Normal", color: "#10B981", severity: "normal" },
    tachypnea: { min: 20, max: 25, label: "Tachypnea", color: "#F59E0B", severity: "high" },
    critical_high: { min: 25, max: 60, label: "Critical High", color: "#DC2626", severity: "critical" }
  }
};

// ==================== ANOMALY DETECTION ====================

export function detectAnomalies(vitals) {
  const anomalies = [];
  
  vitals.forEach((vital, index) => {
    // Check for impossible values
    if (vital.heartRate > 250 || vital.heartRate < 20) {
      anomalies.push({
        index,
        time: vital.time,
        type: 'impossible_value',
        vital: 'heartRate',
        value: vital.heartRate,
        message: `Impossible heart rate: ${vital.heartRate} bpm (sensor error)`
      });
    }
    
    if (vital.respirationRate > 50 || vital.respirationRate < 4) {
      anomalies.push({
        index,
        time: vital.time,
        type: 'impossible_value',
        vital: 'respirationRate',
        value: vital.respirationRate,
        message: `Impossible respiration: ${vital.respirationRate} br/min (sensor error)`
      });
    }
    
    // Check for sudden spikes (if previous reading exists)
    if (index > 0) {
      const prev = vitals[index - 1];
      const hrChange = Math.abs(vital.heartRate - prev.heartRate);
      const rrChange = Math.abs(vital.respirationRate - prev.respirationRate);
      
      // Heart rate shouldn't change more than 40 bpm in one reading (usually 1 min)
      if (hrChange > 40) {
        anomalies.push({
          index,
          time: vital.time,
          type: 'sudden_change',
          vital: 'heartRate',
          value: vital.heartRate,
          previousValue: prev.heartRate,
          change: hrChange,
          message: `Sudden heart rate change: ${hrChange} bpm in 1 reading`
        });
      }
      
      // Respiration shouldn't change more than 10 br/min in one reading
      if (rrChange > 10) {
        anomalies.push({
          index,
          time: vital.time,
          type: 'sudden_change',
          vital: 'respirationRate',
          value: vital.respirationRate,
          previousValue: prev.respirationRate,
          change: rrChange,
          message: `Sudden respiration change: ${rrChange} br/min in 1 reading`
        });
      }
    }
  });
  
  return anomalies;
}

export function filterOutAnomalies(vitals) {
  const anomalies = detectAnomalies(vitals);
  const anomalyIndices = new Set(anomalies.map(a => a.index));
  
  return {
    filtered: vitals.map((v, i) => ({
      ...v,
      isAnomaly: anomalyIndices.has(i)
    })),
    anomalies,
    cleanData: vitals.filter((_, i) => !anomalyIndices.has(i))
  };
}

// ==================== BASELINE CALCULATION ====================

export function calculateBaseline(vitals, vitalType) {
  if (!vitals || vitals.length === 0) return null;
  
  // Remove anomalies first
  const { cleanData } = filterOutAnomalies(vitals);
  
  if (cleanData.length === 0) return null;
  
  const values = cleanData.map(v => v[vitalType]).filter(val => val > 0);
  
  if (values.length === 0) return null;
  
  // Calculate median (more robust than mean for medical data)
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 === 0 
    ? (sorted[mid - 1] + sorted[mid]) / 2 
    : sorted[mid];
  
  // Calculate standard deviation
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  const stdDev = Math.sqrt(variance);
  
  return {
    median: Math.round(median * 10) / 10,
    mean: Math.round(mean * 10) / 10,
    stdDev: Math.round(stdDev * 10) / 10,
    min: Math.min(...values),
    max: Math.max(...values)
  };
}

export function getDeviationFromBaseline(currentValue, baseline) {
  if (!baseline) return null;
  
  const deviation = currentValue - baseline.median;
  const percentDeviation = ((deviation / baseline.median) * 100).toFixed(1);
  
  return {
    absolute: Math.round(deviation * 10) / 10,
    percent: percentDeviation,
    withinNormal: Math.abs(deviation) <= baseline.stdDev * 2,
    message: deviation > 0 
      ? `+${Math.abs(deviation).toFixed(1)} from baseline (${percentDeviation}% above)`
      : `-${Math.abs(deviation).toFixed(1)} from baseline (${Math.abs(percentDeviation)}% below)`
  };
}

// ==================== TREND ANALYSIS ====================

export function analyzeTrend(vitals, vitalType, timeWindowMinutes = 60) {
  if (!vitals || vitals.length < 2) return { trend: 'stable', arrow: '→', message: 'Insufficient data' };
  
  // Get data within time window
  const now = new Date(vitals[vitals.length - 1].time);
  const windowStart = new Date(now.getTime() - timeWindowMinutes * 60 * 1000);
  
  const recentData = vitals.filter(v => new Date(v.time) >= windowStart);
  
  if (recentData.length < 2) return { trend: 'stable', arrow: '→', message: 'Insufficient recent data' };
  
  const values = recentData.map(v => v[vitalType]);
  const times = recentData.map(v => new Date(v.time).getTime());
  
  // Simple linear regression
  const n = values.length;
  const sumX = times.reduce((a, b) => a + b, 0);
  const sumY = values.reduce((a, b) => a + b, 0);
  const sumXY = times.reduce((sum, x, i) => sum + x * values[i], 0);
  const sumX2 = times.reduce((sum, x) => sum + x * x, 0);
  
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  
  // Normalize slope to per-hour rate of change
  const slopePerHour = slope * (60 * 60 * 1000);
  
  // Determine trend
  let trend, arrow, severity;
  if (Math.abs(slopePerHour) < 1) {
    trend = 'stable';
    arrow = '→';
    severity = 'normal';
  } else if (slopePerHour > 0) {
    if (slopePerHour > 5) {
      trend = 'rapidly increasing';
      arrow = '⬆⬆';
      severity = 'high';
    } else {
      trend = 'increasing';
      arrow = '↑';
      severity = 'moderate';
    }
  } else {
    if (slopePerHour < -5) {
      trend = 'rapidly decreasing';
      arrow = '⬇⬇';
      severity = 'high';
    } else {
      trend = 'decreasing';
      arrow = '↓';
      severity = 'moderate';
    }
  }
  
  const firstValue = values[0];
  const lastValue = values[values.length - 1];
  const totalChange = lastValue - firstValue;
  
  return {
    trend,
    arrow,
    severity,
    slope: slopePerHour,
    change: totalChange,
    message: `${trend} (${totalChange > 0 ? '+' : ''}${totalChange.toFixed(1)} in ${timeWindowMinutes} min)`
  };
}

// ==================== NEWS SCORE CALCULATION ====================

export function calculateNEWSScore(vitals) {
  if (!vitals || !vitals.heartRate || !vitals.respirationRate) {
    return { score: 0, level: 'Unknown', message: 'Insufficient data' };
  }
  
  let score = 0;
  
  // Respiration Rate
  if (vitals.respirationRate <= 8) score += 3;
  else if (vitals.respirationRate <= 11) score += 1;
  else if (vitals.respirationRate <= 20) score += 0;
  else if (vitals.respirationRate <= 24) score += 2;
  else score += 3;
  
  // Heart Rate
  if (vitals.heartRate <= 40) score += 3;
  else if (vitals.heartRate <= 50) score += 1;
  else if (vitals.heartRate <= 90) score += 0;
  else if (vitals.heartRate <= 110) score += 1;
  else if (vitals.heartRate <= 130) score += 2;
  else score += 3;
  
  // Determine clinical response level
  let level, color, action;
  if (score === 0) {
    level = 'Low';
    color = '#10B981';
    action = 'Continue routine monitoring';
  } else if (score <= 4) {
    level = 'Low-Medium';
    color = '#F59E0B';
    action = 'Increase monitoring frequency';
  } else if (score <= 6) {
    level = 'Medium';
    color = '#EF4444';
    action = 'Urgent clinical review required';
  } else {
    level = 'High';
    color = '#DC2626';
    action = 'Emergency response - immediate intervention';
  }
  
  return {
    score,
    level,
    color,
    action,
    message: `NEWS Score: ${score} (${level} Risk)`
  };
}

// ==================== MULTI-VITAL CORRELATION ====================

export function analyzeVitalCorrelation(vitals) {
  if (!vitals || !vitals.heartRate || !vitals.respirationRate) {
    return { correlation: 'unknown', severity: 'normal', message: 'Insufficient data' };
  }
  
  const hr = vitals.heartRate;
  const rr = vitals.respirationRate;
  const movement = vitals.movement || 0;
  
  const hrRange = CLINICAL_RANGES.heartRate;
  const rrRange = CLINICAL_RANGES.respirationRate;
  
  // Determine individual severity
  const hrSeverity = Object.values(hrRange).find(r => hr >= r.min && hr <= r.max)?.severity || 'normal';
  const rrSeverity = Object.values(rrRange).find(r => rr >= r.min && rr <= r.max)?.severity || 'normal';
  
  // Critical combinations
  if (hrSeverity === 'critical' && rrSeverity === 'critical') {
    return {
      correlation: 'critical_multi',
      severity: 'critical',
      message: '⚠️ CRITICAL: Multiple vital signs critically abnormal - immediate medical attention required',
      color: '#DC2626'
    };
  }
  
  if ((hrSeverity === 'high' || hrSeverity === 'critical') && 
      (rrSeverity === 'high' || rrSeverity === 'critical') && 
      movement < 2) {
    return {
      correlation: 'distress_pattern',
      severity: 'high',
      message: '⚠️ WARNING: High heart rate + high respiration + low movement suggests possible distress',
      color: '#EF4444'
    };
  }
  
  if (hrSeverity === 'high' && rrSeverity === 'high') {
    return {
      correlation: 'elevated_vitals',
      severity: 'moderate',
      message: 'ℹ️ NOTICE: Both heart rate and respiration elevated - monitor closely',
      color: '#F59E0B'
    };
  }
  
  if (hrSeverity === 'low' && rrSeverity === 'low' && movement < 1) {
    return {
      correlation: 'low_activity',
      severity: 'moderate',
      message: 'ℹ️ NOTICE: Low vitals with minimal movement - patient may be resting or sedated',
      color: '#3B82F6'
    };
  }
  
  if (hrSeverity === 'normal' && rrSeverity === 'normal') {
    return {
      correlation: 'normal',
      severity: 'normal',
      message: '✓ All vital signs within normal range',
      color: '#10B981'
    };
  }
  
  return {
    correlation: 'mixed',
    severity: Math.max(hrSeverity, rrSeverity) === 'critical' ? 'high' : 'moderate',
    message: 'Mixed vital signs - individual assessment required',
    color: '#F59E0B'
  };
}

// ==================== DATA QUALITY ASSESSMENT ====================

export function assessDataQuality(vitals, latestTime) {
  if (!vitals || vitals.length === 0) {
    return {
      quality: 'no_data',
      reliability: 0,
      message: 'No data available',
      color: '#9CA3AF'
    };
  }
  
  const now = new Date();
  const latest = new Date(latestTime);
  const minutesSinceLastReading = (now - latest) / (1000 * 60);
  
  // Check reading frequency
  if (minutesSinceLastReading > 10) {
    return {
      quality: 'stale',
      reliability: 30,
      message: `⚠️ Last reliable reading: ${Math.floor(minutesSinceLastReading)} minutes ago (sensor may be disconnected)`,
      color: '#EF4444'
    };
  }
  
  // Check for anomalies
  const { anomalies } = filterOutAnomalies(vitals.slice(-20)); // Check last 20 readings
  const anomalyRate = (anomalies.length / Math.min(20, vitals.length)) * 100;
  
  if (anomalyRate > 20) {
    return {
      quality: 'poor',
      reliability: 50,
      message: '⚠️ High rate of sensor errors detected - data may be unreliable',
      color: '#F59E0B'
    };
  }
  
  if (anomalyRate > 5) {
    return {
      quality: 'moderate',
      reliability: 75,
      message: 'ℹ️ Some sensor irregularities detected - monitor data quality',
      color: '#3B82F6'
    };
  }
  
  return {
    quality: 'good',
    reliability: 95,
    message: '✓ Data quality good - sensors functioning normally',
    color: '#10B981'
  };
}

// ==================== CLINICAL ZONE HELPER ====================

export function getClinicalZone(value, vitalType) {
  const ranges = CLINICAL_RANGES[vitalType];
  if (!ranges) return null;
  
  for (const [key, range] of Object.entries(ranges)) {
    if (value >= range.min && value <= range.max) {
      return {
        zone: key,
        ...range
      };
    }
  }
  
  return null;
}

// ==================== PREDICTIVE ALERTS ====================

export function generatePredictiveAlert(vitals, vitalType) {
  if (!vitals || vitals.length < 10) return null;
  
  const trend = analyzeTrend(vitals, vitalType, 30);
  const latest = vitals[vitals.length - 1][vitalType];
  const zone = getClinicalZone(latest, vitalType);
  
  // Predict where the vital will be in 30 minutes
  const predictedValue = latest + (trend.slope * 0.5); // 0.5 hours = 30 minutes
  const predictedZone = getClinicalZone(predictedValue, vitalType);
  
  if (!predictedZone || !zone) return null;
  
  // Check if trending toward danger
  if (zone.severity === 'normal' && (predictedZone.severity === 'high' || predictedZone.severity === 'critical')) {
    return {
      type: 'predictive_warning',
      message: `⚠️ TREND ALERT: ${vitalType} trending toward ${predictedZone.label} range (predicted: ${predictedValue.toFixed(1)} in 30 min)`,
      severity: 'high',
      color: '#EF4444'
    };
  }
  
  if ((zone.severity === 'high' || zone.severity === 'low') && predictedZone.severity === 'critical') {
    return {
      type: 'predictive_critical',
      message: `🚨 CRITICAL TREND: ${vitalType} trending toward critical range (predicted: ${predictedValue.toFixed(1)} in 30 min)`,
      severity: 'critical',
      color: '#DC2626'
    };
  }
  
  return null;
}