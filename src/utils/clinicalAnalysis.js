// src/utils/clinicalAnalysis.js - Complete Clinical Analysis with User-Friendly Mode

/**
 * Clinical Vitals Analysis Utility
 * Supports both medical-grade (doctors) and user-friendly (caregivers) modes
 */

// ==================== CLINICAL RANGES ====================

export const CLINICAL_RANGES = {
  heartRate: {
    critical_low: { 
      min: 0, max: 40, 
      label: "Critical Bradycardia", 
      friendlyLabel: "Critically Low",
      color: "#DC2626", 
      severity: "critical",
      description: "Heart beating dangerously slow - needs immediate medical attention",
      action: "Emergency response required"
    },
    bradycardia: { 
      min: 40, max: 60, 
      label: "Bradycardia", 
      friendlyLabel: "Below Normal",
      color: "#3B82F6", 
      severity: "low",
      description: "Heart beating slower than usual - may be normal for some patients",
      action: "Monitor and inform doctor if persistent"
    },
    normal: { 
      min: 60, max: 100, 
      label: "Normal", 
      friendlyLabel: "Healthy Range",
      color: "#10B981", 
      severity: "normal",
      description: "Heart rate is in the healthy normal range",
      action: "Continue routine monitoring"
    },
    tachycardia: { 
      min: 100, max: 120, 
      label: "Tachycardia", 
      friendlyLabel: "Elevated",
      color: "#F59E0B", 
      severity: "high",
      description: "Heart beating faster than usual - may indicate stress, fever, or activity",
      action: "Monitor closely and check for fever or discomfort"
    },
    critical_high: { 
      min: 120, max: 300, 
      label: "Critical Tachycardia", 
      friendlyLabel: "Critically High",
      color: "#DC2626", 
      severity: "critical",
      description: "Heart beating dangerously fast - needs immediate medical attention",
      action: "Emergency response required"
    }
  },
  respirationRate: {
    critical_low: { 
      min: 0, max: 8, 
      label: "Critical Bradypnea", 
      friendlyLabel: "Critically Low",
      color: "#DC2626", 
      severity: "critical",
      description: "Breathing dangerously slow - needs immediate medical attention",
      action: "Emergency response required"
    },
    bradypnea: { 
      min: 8, max: 12, 
      label: "Bradypnea", 
      friendlyLabel: "Below Normal",
      color: "#3B82F6", 
      severity: "low",
      description: "Breathing slower than usual - may be normal during rest",
      action: "Monitor and inform doctor if persistent"
    },
    normal: { 
      min: 12, max: 20, 
      label: "Normal", 
      friendlyLabel: "Healthy Range",
      color: "#10B981", 
      severity: "normal",
      description: "Breathing rate is in the healthy normal range",
      action: "Continue routine monitoring"
    },
    tachypnea: { 
      min: 20, max: 25, 
      label: "Tachypnea", 
      friendlyLabel: "Elevated",
      color: "#F59E0B", 
      severity: "high",
      description: "Breathing faster than usual - may indicate distress or activity",
      action: "Monitor closely and check patient comfort"
    },
    critical_high: { 
      min: 25, max: 60, 
      label: "Critical Tachypnea", 
      friendlyLabel: "Critically High",
      color: "#DC2626", 
      severity: "critical",
      description: "Breathing dangerously fast - needs immediate medical attention",
      action: "Emergency response required"
    }
  },
  movement: {
    none: { 
      min: 0, max: 0, 
      label: "No Movement", 
      friendlyLabel: "Still / Resting",
      color: "#DC2626", 
      severity: "low",
      description: "Patient is completely still - may be sleeping or resting deeply",
      action: "Check on patient if prolonged"
    },
    minimal: { 
      min: 1, max: 1, 
      label: "Minimal Activity", 
      friendlyLabel: "Very Light Movement",
      color: "#F59E0B", 
      severity: "low",
      description: "Very slight movements detected - patient mostly resting",
      action: "Normal for resting patients"
    },
    light: { 
      min: 2, max: 2, 
      label: "Light Activity", 
      friendlyLabel: "Light Activity",
      color: "#10B981", 
      severity: "normal",
      description: "Light movements like shifting position or gentle activity",
      action: "Good activity level"
    },
    moderate: { 
      min: 3, max: 3, 
      label: "Moderate Activity", 
      friendlyLabel: "Moderate Activity",
      color: "#10B981", 
      severity: "normal",
      description: "Regular movements - walking slowly or doing light tasks",
      action: "Healthy activity level"
    },
    active: { 
      min: 4, max: 4, 
      label: "Active", 
      friendlyLabel: "Active",
      color: "#3B82F6", 
      severity: "normal",
      description: "Patient is quite active - walking normally or exercising",
      action: "Good mobility"
    },
    very_active: { 
      min: 5, max: 10, 
      label: "Very Active", 
      friendlyLabel: "Very Active",
      color: "#3B82F6", 
      severity: "normal",
      description: "High activity level - vigorous movement or exercise",
      action: "Excellent mobility"
    }
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
        message: `Impossible heart rate: ${vital.heartRate} bpm`,
        friendlyMessage: `Sensor error detected - heart rate reading seems incorrect (${vital.heartRate} bpm)`
      });
    }
    
    if (vital.respirationRate > 50 || vital.respirationRate < 4) {
      anomalies.push({
        index,
        time: vital.time,
        type: 'impossible_value',
        vital: 'respirationRate',
        value: vital.respirationRate,
        message: `Impossible respiration: ${vital.respirationRate} br/min`,
        friendlyMessage: `Sensor error detected - breathing rate reading seems incorrect (${vital.respirationRate} br/min)`
      });
    }
    
    // Check for sudden spikes (if previous reading exists)
    if (index > 0) {
      const prev = vitals[index - 1];
      const hrChange = Math.abs(vital.heartRate - prev.heartRate);
      const rrChange = Math.abs(vital.respirationRate - prev.respirationRate);
      
      if (hrChange > 40) {
        anomalies.push({
          index,
          time: vital.time,
          type: 'sudden_change',
          vital: 'heartRate',
          value: vital.heartRate,
          previousValue: prev.heartRate,
          change: hrChange,
          message: `Sudden heart rate change: ${hrChange} bpm`,
          friendlyMessage: `Heart rate changed suddenly by ${hrChange} bpm - may be a sensor reading error`
        });
      }
      
      if (rrChange > 10) {
        anomalies.push({
          index,
          time: vital.time,
          type: 'sudden_change',
          vital: 'respirationRate',
          value: vital.respirationRate,
          previousValue: prev.respirationRate,
          change: rrChange,
          message: `Sudden respiration change: ${rrChange} br/min`,
          friendlyMessage: `Breathing rate changed suddenly by ${rrChange} br/min - may be a sensor reading error`
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
  
  const { cleanData } = filterOutAnomalies(vitals);
  
  if (cleanData.length === 0) return null;
  
  const values = cleanData.map(v => v[vitalType]).filter(val => val > 0);
  
  if (values.length === 0) return null;
  
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 === 0 
    ? (sorted[mid - 1] + sorted[mid]) / 2 
    : sorted[mid];
  
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
      : `-${Math.abs(deviation).toFixed(1)} from baseline (${Math.abs(percentDeviation)}% below)`,
    friendlyMessage: deviation > 0
      ? `Currently ${Math.abs(deviation).toFixed(1)} points higher than usual`
      : `Currently ${Math.abs(deviation).toFixed(1)} points lower than usual`
  };
}

// ==================== TREND ANALYSIS ====================

export function analyzeTrend(vitals, vitalType, timeWindowMinutes = 60) {
  if (!vitals || vitals.length < 2) {
    return { 
      trend: 'stable', 
      arrow: '→', 
      severity: 'normal',
      message: 'Insufficient data',
      friendlyMessage: 'Not enough readings yet to detect trends'
    };
  }
  
  const now = new Date(vitals[vitals.length - 1].time);
  const windowStart = new Date(now.getTime() - timeWindowMinutes * 60 * 1000);
  
  const recentData = vitals.filter(v => new Date(v.time) >= windowStart);
  
  if (recentData.length < 2) {
    return { 
      trend: 'stable', 
      arrow: '→', 
      severity: 'normal',
      message: 'Insufficient recent data',
      friendlyMessage: 'Not enough recent readings to detect trends'
    };
  }
  
  const values = recentData.map(v => v[vitalType]);
  const times = recentData.map(v => new Date(v.time).getTime());
  
  // Simple linear regression
  const n = values.length;
  const sumX = times.reduce((a, b) => a + b, 0);
  const sumY = values.reduce((a, b) => a + b, 0);
  const sumXY = times.reduce((sum, x, i) => sum + x * values[i], 0);
  const sumX2 = times.reduce((sum, x) => sum + x * x, 0);
  
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const slopePerHour = slope * (60 * 60 * 1000);
  
  const firstValue = values[0];
  const lastValue = values[values.length - 1];
  const totalChange = lastValue - firstValue;
  
  // Determine trend
  let trend, arrow, severity, message, friendlyMessage;
  
  if (Math.abs(slopePerHour) < 1) {
    trend = 'stable';
    arrow = '→';
    severity = 'normal';
    message = `Stable (${totalChange > 0 ? '+' : ''}${totalChange.toFixed(1)} in ${timeWindowMinutes} min)`;
    friendlyMessage = `Readings are steady with minimal changes`;
  } else if (slopePerHour > 0) {
    if (slopePerHour > 5) {
      trend = 'rapidly increasing';
      arrow = '⬆⬆';
      severity = 'high';
      message = `Rapidly increasing (+${totalChange.toFixed(1)} in ${timeWindowMinutes} min)`;
      friendlyMessage = `Rising quickly - increased by ${totalChange.toFixed(1)} in the last hour`;
    } else {
      trend = 'increasing';
      arrow = '↑';
      severity = 'moderate';
      message = `Increasing (+${totalChange.toFixed(1)} in ${timeWindowMinutes} min)`;
      friendlyMessage = `Gradually rising - up ${totalChange.toFixed(1)} in the last hour`;
    }
  } else {
    if (slopePerHour < -5) {
      trend = 'rapidly decreasing';
      arrow = '⬇⬇';
      severity = 'high';
      message = `Rapidly decreasing (${totalChange.toFixed(1)} in ${timeWindowMinutes} min)`;
      friendlyMessage = `Falling quickly - decreased by ${Math.abs(totalChange).toFixed(1)} in the last hour`;
    } else {
      trend = 'decreasing';
      arrow = '↓';
      severity = 'moderate';
      message = `Decreasing (${totalChange.toFixed(1)} in ${timeWindowMinutes} min)`;
      friendlyMessage = `Gradually falling - down ${Math.abs(totalChange).toFixed(1)} in the last hour`;
    }
  }
  
  return {
    trend,
    arrow,
    severity,
    slope: slopePerHour,
    change: totalChange,
    message,
    friendlyMessage
  };
}

// ==================== NEWS SCORE CALCULATION ====================

export function calculateNEWSScore(vitals) {
  if (!vitals || !vitals.heartRate || !vitals.respirationRate) {
    return { 
      score: 0, 
      level: 'Unknown', 
      message: 'Insufficient data',
      friendlyMessage: 'Not enough readings to calculate health score'
    };
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
  let level, color, action, friendlyLevel, friendlyAction;
  
  if (score === 0) {
    level = 'Low';
    friendlyLevel = 'All Good';
    color = '#10B981';
    action = 'Continue routine monitoring';
    friendlyAction = 'Patient is doing well - continue regular checks';
  } else if (score <= 4) {
    level = 'Low-Medium';
    friendlyLevel = 'Watch Closely';
    color = '#F59E0B';
    action = 'Increase monitoring frequency';
    friendlyAction = 'Some signs need attention - check on patient more often';
  } else if (score <= 6) {
    level = 'Medium';
    friendlyLevel = 'Needs Attention';
    color = '#EF4444';
    action = 'Urgent clinical review required';
    friendlyAction = 'Patient needs medical attention soon - inform doctor';
  } else {
    level = 'High';
    friendlyLevel = 'Emergency';
    color = '#DC2626';
    action = 'Emergency response - immediate intervention';
    friendlyAction = 'Emergency situation - call for immediate medical help';
  }
  
  return {
    score,
    level,
    friendlyLevel,
    color,
    action,
    friendlyAction,
    message: `NEWS Score: ${score} (${level} Risk)`,
    friendlyMessage: `Health Alert Level: ${friendlyLevel}`
  };
}

// ==================== MULTI-VITAL CORRELATION ====================

export function analyzeVitalCorrelation(vitals) {
  if (!vitals || !vitals.heartRate || !vitals.respirationRate) {
    return { 
      correlation: 'unknown', 
      severity: 'normal', 
      message: 'Insufficient data',
      friendlyMessage: 'Not enough readings to analyze patterns'
    };
  }
  
  const hr = vitals.heartRate;
  const rr = vitals.respirationRate;
  const movement = vitals.movement || 0;
  
  const hrRange = CLINICAL_RANGES.heartRate;
  const rrRange = CLINICAL_RANGES.respirationRate;
  
  const hrSeverity = Object.values(hrRange).find(r => hr >= r.min && hr <= r.max)?.severity || 'normal';
  const rrSeverity = Object.values(rrRange).find(r => rr >= r.min && rr <= r.max)?.severity || 'normal';
  
  // Critical combinations
  if (hrSeverity === 'critical' && rrSeverity === 'critical') {
    return {
      correlation: 'critical_multi',
      severity: 'critical',
      message: '⚠️ CRITICAL: Multiple vital signs critically abnormal',
      friendlyMessage: '🚨 EMERGENCY: Both heart rate and breathing are at critical levels - get medical help immediately',
      color: '#DC2626'
    };
  }
  
  if ((hrSeverity === 'high' || hrSeverity === 'critical') && 
      (rrSeverity === 'high' || rrSeverity === 'critical') && 
      movement < 2) {
    return {
      correlation: 'distress_pattern',
      severity: 'high',
      message: '⚠️ WARNING: Elevated vitals with low movement',
      friendlyMessage: '⚠️ Patient may be in distress - high heart rate and fast breathing but not moving much. Check on them now.',
      color: '#EF4444'
    };
  }
  
  if (hrSeverity === 'high' && rrSeverity === 'high') {
    return {
      correlation: 'elevated_vitals',
      severity: 'moderate',
      message: 'ℹ️ NOTICE: Both heart rate and respiration elevated',
      friendlyMessage: 'ℹ️ Both heart rate and breathing are higher than normal - patient may be active, stressed, or uncomfortable',
      color: '#F59E0B'
    };
  }
  
  if (hrSeverity === 'low' && rrSeverity === 'low' && movement < 1) {
    return {
      correlation: 'low_activity',
      severity: 'moderate',
      message: 'ℹ️ NOTICE: Low vitals with minimal movement',
      friendlyMessage: 'ℹ️ Patient is resting quietly - heart rate and breathing are slower, which is normal during rest',
      color: '#3B82F6'
    };
  }
  
  if (hrSeverity === 'normal' && rrSeverity === 'normal') {
    return {
      correlation: 'normal',
      severity: 'normal',
      message: '✓ All vital signs within normal range',
      friendlyMessage: '✓ Everything looks good - all vital signs are healthy',
      color: '#10B981'
    };
  }
  
  return {
    correlation: 'mixed',
    severity: hrSeverity === 'critical' || rrSeverity === 'critical' ? 'high' : 'moderate',
    message: 'Mixed vital signs - individual assessment required',
    friendlyMessage: 'Some readings are normal, others need attention - monitor patient closely',
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
      friendlyMessage: 'No readings available yet',
      color: '#9CA3AF'
    };
  }
  
  const now = new Date();
  const latest = new Date(latestTime);
  const minutesSinceLastReading = (now - latest) / (1000 * 60);
  
  if (minutesSinceLastReading > 10) {
    return {
      quality: 'stale',
      reliability: 30,
      message: `Last reading: ${Math.floor(minutesSinceLastReading)} minutes ago`,
      friendlyMessage: `⚠️ Last reading was ${Math.floor(minutesSinceLastReading)} minutes ago - sensor may be disconnected`,
      color: '#EF4444'
    };
  }
  
  const { anomalies } = filterOutAnomalies(vitals.slice(-20));
  const anomalyRate = (anomalies.length / Math.min(20, vitals.length)) * 100;
  
  if (anomalyRate > 20) {
    return {
      quality: 'poor',
      reliability: 50,
      message: 'High sensor error rate detected',
      friendlyMessage: '⚠️ Sensors may not be working properly - many unusual readings detected',
      color: '#F59E0B'
    };
  }
  
  if (anomalyRate > 5) {
    return {
      quality: 'moderate',
      reliability: 75,
      message: 'Some sensor irregularities detected',
      friendlyMessage: 'ℹ️ A few unusual readings detected - sensors mostly working well',
      color: '#3B82F6'
    };
  }
  
  return {
    quality: 'good',
    reliability: 95,
    message: 'Data quality good',
    friendlyMessage: '✓ Sensors are working properly - readings look reliable',
    color: '#10B981'
  };
}

// ==================== CLINICAL ZONE HELPER ====================

export function getClinicalZone(value, vitalType, useFriendlyLabels = false) {
  const ranges = CLINICAL_RANGES[vitalType];
  if (!ranges) return null;
  
  for (const [key, range] of Object.entries(ranges)) {
    if (value >= range.min && value <= range.max) {
      return {
        zone: key,
        ...range,
        displayLabel: useFriendlyLabels ? range.friendlyLabel : range.label
      };
    }
  }
  
  return null;
}

// ==================== PREDICTIVE ALERTS ====================

export function generatePredictiveAlert(vitals, vitalType, useFriendlyLabels = false) {
  if (!vitals || vitals.length < 10) return null;
  
  const trend = analyzeTrend(vitals, vitalType, 30);
  const latest = vitals[vitals.length - 1][vitalType];
  const zone = getClinicalZone(latest, vitalType, useFriendlyLabels);
  
  const predictedValue = latest + (trend.slope * 0.5);
  const predictedZone = getClinicalZone(predictedValue, vitalType, useFriendlyLabels);
  
  if (!predictedZone || !zone) return null;
  
  if (zone.severity === 'normal' && (predictedZone.severity === 'high' || predictedZone.severity === 'critical')) {
    return {
      type: 'predictive_warning',
      message: `⚠️ TREND ALERT: ${vitalType} trending toward ${predictedZone.label}`,
      friendlyMessage: `⚠️ Warning: ${vitalType === 'heartRate' ? 'Heart rate' : 'Breathing rate'} is trending ${trend.trend === 'increasing' ? 'up' : 'down'} and may reach ${predictedZone.friendlyLabel} levels soon`,
      severity: 'high',
      color: '#EF4444'
    };
  }
  
  if ((zone.severity === 'high' || zone.severity === 'low') && predictedZone.severity === 'critical') {
    return {
      type: 'predictive_critical',
      message: `🚨 CRITICAL TREND: ${vitalType} trending toward critical range`,
      friendlyMessage: `🚨 Urgent: ${vitalType === 'heartRate' ? 'Heart rate' : 'Breathing rate'} is changing rapidly and may become critical - inform medical staff now`,
      severity: 'critical',
      color: '#DC2626'
    };
  }
  
  return null;
}

// ==================== COMPREHENSIVE ANALYSIS ====================

export class ClinicalAnalysis {
  static CLINICAL_RANGES = CLINICAL_RANGES;

  static analyzeVitals(vitalsData, useFriendlyLabels = false) {
    if (!vitalsData || vitalsData.length === 0) {
      return null;
    }

    const latest = vitalsData[vitalsData.length - 1];
    
    return {
      heartRate: this.analyzeMetric(vitalsData, 'heartRate', latest.heartRate, useFriendlyLabels),
      respirationRate: this.analyzeMetric(vitalsData, 'respirationRate', latest.respirationRate, useFriendlyLabels),
      movement: this.analyzeMetric(vitalsData, 'movement', latest.movement, useFriendlyLabels),
      latest,
      newsScore: calculateNEWSScore(latest),
      correlation: analyzeVitalCorrelation(latest),
      dataQuality: assessDataQuality(vitalsData, latest.time),
      summary: this.generateSummary(vitalsData, useFriendlyLabels)
    };
  }

  static analyzeMetric(vitalsData, metricName, currentValue, useFriendlyLabels = false) {
    const baseline = calculateBaseline(vitalsData, metricName);
    const trend = analyzeTrend(vitalsData, metricName, 60);
    const zone = getClinicalZone(currentValue, metricName, useFriendlyLabels);
    const deviation = getDeviationFromBaseline(currentValue, baseline);
    const predictiveAlert = generatePredictiveAlert(vitalsData, metricName, useFriendlyLabels);

    return {
      current: currentValue,
      baseline,
      zone,
      trend,
      deviation,
      predictiveAlert,
      readings: vitalsData.length
    };
  }

  static generateSummary(vitalsData, useFriendlyLabels = false) {
    const latest = vitalsData[vitalsData.length - 1];
    const hrZone = getClinicalZone(latest.heartRate, 'heartRate', useFriendlyLabels);
    const rrZone = getClinicalZone(latest.respirationRate, 'respirationRate', useFriendlyLabels);
    const mvZone = getClinicalZone(latest.movement, 'movement', useFriendlyLabels);

    const alerts = [];
    
    if (hrZone.severity === 'critical' || hrZone.severity === 'high') {
      alerts.push({ 
        type: 'heart', 
        message: useFriendlyLabels ? hrZone.description : hrZone.label, 
        severity: hrZone.severity 
      });
    }
    if (rrZone.severity === 'critical' || rrZone.severity === 'high') {
      alerts.push({ 
        type: 'respiration', 
        message: useFriendlyLabels ? rrZone.description : rrZone.label, 
        severity: rrZone.severity 
      });
    }
    if (mvZone.key === 'none' && vitalsData.length > 5) {
      alerts.push({ 
        type: 'movement', 
        message: useFriendlyLabels ? mvZone.description : mvZone.label, 
        severity: 'moderate' 
      });
    }

    let overallStatus = 'Good';
    let statusColor = '#10B981';
    let statusMessage = useFriendlyLabels 
      ? 'Everything looks healthy' 
      : 'All vital signs are within normal ranges';

    if (alerts.some(a => a.severity === 'critical')) {
      overallStatus = useFriendlyLabels ? 'Emergency' : 'Critical';
      statusColor = '#DC2626';
      statusMessage = useFriendlyLabels 
        ? 'Patient needs immediate medical attention' 
        : 'Critical vital signs require immediate intervention';
    } else if (alerts.some(a => a.severity === 'high')) {
      overallStatus = useFriendlyLabels ? 'Needs Attention' : 'Alert';
      statusColor = '#EF4444';
      statusMessage = useFriendlyLabels 
        ? 'Patient needs to be checked soon' 
        : 'Some vital signs require medical attention';
    } else if (alerts.length > 0) {
      overallStatus = useFriendlyLabels ? 'Watch Closely' : 'Monitor';
      statusColor = '#F59E0B';
      statusMessage = useFriendlyLabels 
        ? 'Keep an eye on patient - some things need monitoring' 
        : 'Some vital signs should be monitored closely';
    }

    return {
      overallStatus,
      statusColor,
      statusMessage,
      alerts,
      zones: { heartRate: hrZone, respirationRate: rrZone, movement: mvZone }
    };
  }
}

export default ClinicalAnalysis;