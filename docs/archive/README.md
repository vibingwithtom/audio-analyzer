# Archived Implementation Plans

This directory contains implementation plans that were **revised or superseded** by updated specifications.

## Archived Plans

### noise-floor-characterization-plan.md

**Original Date**: Prior to 2025-01-18
**Status**: Superseded
**Replaced By**: `/docs/voice-quality/09-advanced-noise-floor-analysis.md`

**Reason for Revision**:

The original plan proposed FFT-based spectral flatness analysis to detect denoising artifacts. After comprehensive review in the context of voice-specific optimization efforts, the plan was revised because:

1. **Performance Impact**: FFT analysis on all quiet windows would add 5-10% processing time
2. **Voice Specificity**: Spectral flatness is more effective for music; voice recordings have naturally sparse spectra
3. **Overlap with Voice Features**: Room Tone Separation (voice-quality #08) already enhanced noise floor analysis
4. **Better Alternatives**: Voice-specific detection methods (digital silence ratio, edge sharpness, room tone variance) are faster and more accurate

**What Changed**:

| Original Plan | Revised Plan |
|---------------|--------------|
| FFT-based spectral flatness | Statistical variance analysis |
| Standalone denoiser detection | Merged with room tone separation |
| +5-10% processing time | +1-2% processing time |
| Music-oriented approach | Voice-optimized methods |

**Key Improvements in Revised Version**:

✅ **Voice-specific detection**: Uses characteristics unique to voice recordings (room tone, breath sounds, speech edges)

✅ **Better performance**: Avoids expensive FFT, uses simple statistical analysis

✅ **Comprehensive**: Combines room tone separation + denoiser detection + diagnostic feedback

✅ **More accurate**: Lower false positive rate on voice recordings

✅ **Integrated architecture**: Works with experimental analysis optimization plan

The revised plan maintains the original goal (detect processing artifacts) while being more efficient and effective for voice-only audio.

---

### voice-dynamic-range-analysis-plan.md

**Original Date**: 2025-01-17
**Status**: Superseded
**Replaced By**: `/docs/voice-quality/10-processing-detection.md`

**Reason for Revision**:

The original plan proposed comprehensive dynamic range analysis with complex percentile-based metrics to detect compression and processing. After clarifying the client requirement ("No processing allowed - compliance validation"), the plan was revised to be simpler and more focused:

1. **Purpose Mismatch**: Original focused on detailed dynamic analysis; actual need is binary compliance validation (processed vs unprocessed)
2. **Complexity**: Complex percentile analysis (syllabic, phrasal, P10/P50/P90) unnecessary for simple pass/fail
3. **False Positives**: Natural speech dynamics vary widely (4-20 dB range), making gradual thresholds unreliable
4. **Overlap**: Most artifacts already detected by other features (#09 Advanced Noise Floor, clipping analysis)
5. **Effort**: 9-11 days implementation vs 2-3 days for simplified approach

**What Changed**:

| Original Plan | Revised Plan |
|---------------|--------------|
| Complex percentile analysis (P10/P50/P90) | Simple dynamic range calculation |
| Gradual thresholds (natural/light/moderate/heavy) | Binary detection (processed/unprocessed) |
| Syllabic + phrasal window analysis | Single speech-segment analysis |
| Standalone artifact detection | Aggregates existing detections (#09, clipping) |
| 9-11 days effort | 2-3 days effort |
| +8-10% processing time | +2-3% processing time |

**Key Improvements in Revised Version**:

✅ **Compliance-focused**: Binary pass/fail for "no processing" requirement

✅ **Conservative thresholds**: Detects only obvious processing (minimizes false positives)

✅ **Simplified implementation**: Basic dynamic range + AGC pattern detection

✅ **Better integration**: Aggregates existing detections from other features

✅ **Lower effort**: 2-3 days vs 9-11 days

The revised plan maintains the original goal (detect processing for compliance) while being simpler, faster, and more reliable for the actual use case.

---

**Note**: Archived plans are preserved for historical reference and to document decision-making rationale. They are not intended for implementation in their original form.
