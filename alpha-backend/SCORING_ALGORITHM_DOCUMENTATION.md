# CV-JD Matching Scoring Algorithm Documentation

## Overview
The CV-JD matching system uses a sophisticated multi-component scoring algorithm that analyzes skills, responsibilities, job titles, and experience to determine candidate suitability. The system uses **GPT-4o-mini** for text standardization and **all-mpnet-base-v2** embeddings for semantic similarity calculations.

## Scoring Components

### 1. **Skills Score (40% weight)**
- **Method**: Individual skill matching using vector embeddings
- **Process**:
  - GPT-4o-mini extracts skills from both JD and CV
  - Each skill is converted to embeddings using all-mpnet-base-v2
  - Cosine similarity calculated between JD skills and CV skills
  - Similarity threshold: 0.7 for skill matches
- **Formula**: `(Number of matched skills / Total required skills) * 100`
- **Example**: If JD requires 10 skills and CV matches 6, score = 60%

### 2. **Responsibility Score (35% weight)**
- **Method**: Semantic matching of job responsibilities
- **Process**:
  - GPT-4o-mini extracts responsibility sentences from JD
  - GPT-4o-mini extracts experience/responsibilities from CV
  - Vector similarity matching between responsibility sets
  - Threshold: 0.65 for responsibility matches
- **Formula**: `(Number of matched responsibilities / Total required responsibilities) * 100`
- **Example**: If JD has 8 responsibilities and CV matches 3, score = 37.5%

### 3. **Job Title Score (15% weight)**
- **Method**: Semantic similarity between job titles
- **Process**:
  - Direct embedding comparison of standardized job titles
  - Cosine similarity calculation
  - Converted to percentage (similarity * 100)
- **Quality Levels**:
  - **Excellent**: ≥ 80% similarity
  - **Good**: 60-79% similarity  
  - **Moderate**: < 60% similarity

### 4. **Experience Score (10% weight)**
- **Method**: Years of experience comparison
- **Process**:
  - Extract numeric years from JD requirements
  - Extract numeric years from CV experience
  - Boolean comparison: `CV_years >= Required_years`
- **Scoring**:
  - **100%**: Meets or exceeds requirement
  - **50%**: Does not meet requirement
  - **Default**: 100% if parsing fails

## Overall Score Calculation

### Weighted Formula
```
Overall Score = (Skills_Score × 0.40) + 
                (Responsibility_Score × 0.35) + 
                (Title_Score × 0.15) + 
                (Experience_Score × 0.10)
```

### Component Weights Justification
- **Skills (40%)**: Most critical for technical role fit
- **Responsibilities (35%)**: Core job function alignment
- **Title (15%)**: Role-level appropriateness
- **Experience (10%)**: Baseline qualification check

## Example Calculation

Given a candidate with:
- Skills: 6/10 matched = 60%
- Responsibilities: 3/8 matched = 37.5%
- Title: 0.75 similarity = 75%
- Experience: Meets requirement = 100%

**Overall Score** = (60 × 0.40) + (37.5 × 0.35) + (75 × 0.15) + (100 × 0.10)
                  = 24 + 13.125 + 11.25 + 10
                  = **58.375%**

## Matching Quality Indicators

### Skill Matching
- **Threshold**: 0.7 cosine similarity
- **High-quality matches**: Skills with >0.9 similarity
- **Moderate matches**: Skills with 0.7-0.9 similarity
- **Unmatched**: Skills below 0.7 threshold

### Responsibility Matching  
- **Threshold**: 0.65 cosine similarity
- **Strong alignment**: Responsibilities with >0.8 similarity
- **Moderate alignment**: Responsibilities with 0.65-0.8 similarity

## Technical Implementation

### Embedding Model
- **Model**: `all-mpnet-base-v2`
- **Dimensions**: 768
- **Provider**: Sentence Transformers
- **Advantages**: 
  - High semantic understanding
  - Excellent for short text similarity
  - Fast inference time

### Standardization Process
1. **Text Extraction**: PyMuPDF, python-docx, Tesseract OCR
2. **GPT Processing**: GPT-4o-mini extracts structured data
3. **Skill Normalization**: Full-word formats (JavaScript vs JS)
4. **Experience Parsing**: Regex extraction of years
5. **Responsibility Structuring**: Numbered list format

### Performance Metrics
- **Analysis Time**: ~30-60 seconds per CV-JD pair
- **Embedding Generation**: ~2-5 seconds per skill/responsibility set
- **Accuracy**: Based on semantic similarity thresholds
- **Scalability**: Batch processing with 3 CV parallel limit

## Score Interpretation Guidelines

### Overall Score Ranges
- **90-100%**: Exceptional match - Strong candidate
- **75-89%**: Very good match - Recommended candidate  
- **60-74%**: Good match - Consider with additional screening
- **45-59%**: Moderate match - May require training/development
- **30-44%**: Weak match - Significant gaps present
- **<30%**: Poor match - Not recommended

### Component Score Analysis
- **High Skills, Low Responsibilities**: Technical fit but experience mismatch
- **High Responsibilities, Low Skills**: Experience fit but technical gaps
- **High Title, Low Overall**: Role-appropriate but skill/experience gaps
- **Low Experience Score**: Junior candidate for senior role

## Limitations and Considerations

### Current Limitations
1. **Language Dependency**: Optimized for English text
2. **Context Sensitivity**: May miss domain-specific terminology
3. **Experience Parsing**: Simple regex-based approach
4. **Binary Experience**: Only checks minimum threshold

### Planned Improvements
1. **Dynamic Weighting**: Adjust weights based on role type
2. **Industry Adaptation**: Specialized scoring for different domains
3. **Soft Skills**: Integration of communication/leadership assessment
4. **Certification Matching**: Specific credential requirements
5. **Location/Salary**: Additional practical constraints

## API Response Format

The scoring system returns detailed analysis in this structure:

```json
{
  "overall_score": 58.375,
  "breakdown": {
    "skills_score": 60.0,
    "responsibility_score": 37.5,
    "title_score": 75.0,
    "experience_score": 100.0
  },
  "detailed_analysis": {
    "skill_analysis": {
      "total_required": 10,
      "matched": 6,
      "match_percentage": 60.0,
      "matches": [...],
      "unmatched": [...]
    },
    "responsibility_analysis": {...},
    "title_analysis": {...},
    "experience_analysis": {...}
  },
  "explanation": "Detailed human-readable explanation"
}
```

## Quality Assurance

### Validation Metrics
- **Consistency**: Same CV-JD pair should produce same score
- **Sensitivity**: Small changes should produce small score changes  
- **Correlation**: Scores should correlate with human assessments
- **Performance**: Analysis should complete within reasonable time

### Testing Approach
- **Unit Tests**: Individual component scoring
- **Integration Tests**: End-to-end matching pipeline
- **Performance Tests**: Speed and resource usage
- **Accuracy Tests**: Comparison with human evaluations

---

*This documentation reflects the current implementation as of January 2025. The algorithm is continuously refined based on user feedback and performance analysis.* 