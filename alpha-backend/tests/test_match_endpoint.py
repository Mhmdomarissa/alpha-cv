"""
Integration tests for the /match endpoint
"""
import pytest
from fastapi.testclient import TestClient
from unittest.mock import Mock, patch
import numpy as np

from app.main import app
from app.schemas.matching import MatchWeights


@pytest.fixture
def client():
    """Test client fixture"""
    return TestClient(app)


@pytest.fixture
def mock_qdrant_utils():
    """Mock Qdrant utils with test data"""
    mock = Mock()
    
    # Mock structured JD
    mock.get_structured_jd.return_value = {
        "id": "jd_1",
        "job_title": "Senior Python Developer",
        "years_of_experience": 5,
        "skills_sentences": [
            "Python programming",
            "Django framework", 
            "REST API development"
        ],
        "responsibility_sentences": [
            "Lead development team",
            "Design system architecture",
            "Code review and mentoring"
        ]
    }
    
    # Mock structured CVs
    mock.get_structured_cv.side_effect = lambda cv_id: {
        "cv_1": {
            "id": "cv_1",
            "name": "John Doe",
            "job_title": "Python Developer",
            "years_of_experience": 6,
            "skills_sentences": [
                "Python development",
                "Django web framework",
                "API design"
            ],
            "responsibility_sentences": [
                "Team leadership",
                "System design",
                "Code reviews"
            ]
        },
        "cv_2": {
            "id": "cv_2", 
            "name": "Jane Smith",
            "job_title": "Software Engineer",
            "years_of_experience": 3,
            "skills_sentences": [
                "Java programming",
                "Spring framework",
                "Database design"
            ],
            "responsibility_sentences": [
                "Feature development",
                "Bug fixing",
                "Testing"
            ]
        }
    }.get(cv_id)
    
    # Mock list all CVs
    mock.list_all_cvs.return_value = [
        {"id": "cv_1", "name": "John Doe"},
        {"id": "cv_2", "name": "Jane Smith"}
    ]
    
    return mock


@pytest.fixture
def mock_embedding_model():
    """Mock embedding model that returns predictable embeddings"""
    mock = Mock()
    
    def mock_encode(texts, normalize_embeddings=True):
        """Return predictable embeddings based on text content"""
        embeddings = []
        for text in texts:
            # Create different embeddings based on text similarity
            if "python" in text.lower():
                base = np.array([0.9, 0.1, 0.1])
            elif "django" in text.lower():
                base = np.array([0.8, 0.2, 0.1]) 
            elif "api" in text.lower():
                base = np.array([0.7, 0.3, 0.1])
            elif "lead" in text.lower() or "team" in text.lower():
                base = np.array([0.1, 0.9, 0.1])
            elif "design" in text.lower() or "architect" in text.lower():
                base = np.array([0.1, 0.8, 0.2])
            elif "review" in text.lower():
                base = np.array([0.1, 0.7, 0.3])
            elif "java" in text.lower():
                base = np.array([0.2, 0.1, 0.9])
            else:
                base = np.array([0.3, 0.3, 0.4])
            
            # Normalize if requested
            if normalize_embeddings:
                base = base / np.linalg.norm(base)
            
            embeddings.append(base)
        
        return np.array(embeddings)
    
    mock.encode = mock_encode
    return mock


class TestMatchEndpoint:
    """Test the /match endpoint"""
    
    @patch('app.routes.special_routes.get_qdrant_utils')
    @patch('app.routes.special_routes.get_model')
    def test_match_with_jd_id_success(self, mock_get_model, mock_get_qdrant, 
                                     client, mock_qdrant_utils, mock_embedding_model):
        """Test successful matching with JD ID"""
        mock_get_qdrant.return_value = mock_qdrant_utils
        mock_get_model.return_value = mock_embedding_model
        
        payload = {
            "jd_id": "jd_1",
            "cv_ids": ["cv_1", "cv_2"],
            "weights": {
                "skills": 80,
                "responsibilities": 15,
                "job_title": 2.5,
                "experience": 2.5
            },
            "top_alternatives": 3
        }
        
        response = client.post("/match", json=payload)
        
        assert response.status_code == 200
        data = response.json()
        
        # Check response structure
        assert "jd_id" in data
        assert "jd_job_title" in data
        assert "jd_years" in data
        assert "normalized_weights" in data
        assert "candidates" in data
        
        # Check JD info
        assert data["jd_id"] == "jd_1"
        assert data["jd_job_title"] == "Senior Python Developer"
        assert data["jd_years"] == 5
        
        # Check normalized weights sum to 1
        weights = data["normalized_weights"]
        total_weight = weights["skills"] + weights["responsibilities"] + weights["job_title"] + weights["experience"]
        assert abs(total_weight - 1.0) < 1e-10
        
        # Check candidates
        assert len(data["candidates"]) == 2
        
        # Candidates should be sorted by overall score (descending)
        scores = [c["overall_score"] for c in data["candidates"]]
        assert scores == sorted(scores, reverse=True)
        
        # Check first candidate structure
        candidate = data["candidates"][0]
        assert "cv_id" in candidate
        assert "cv_name" in candidate
        assert "overall_score" in candidate
        assert "skills_score" in candidate
        assert "responsibilities_score" in candidate
        assert "job_title_score" in candidate
        assert "years_score" in candidate
        assert "skills_assignments" in candidate
        assert "responsibilities_assignments" in candidate
        assert "skills_alternatives" in candidate
        assert "responsibilities_alternatives" in candidate
        
        # Check assignments structure
        if candidate["skills_assignments"]:
            assignment = candidate["skills_assignments"][0]
            assert "type" in assignment
            assert "jd_index" in assignment
            assert "jd_item" in assignment
            assert "cv_index" in assignment
            assert "cv_item" in assignment
            assert "score" in assignment
            assert assignment["type"] == "skill"
        
        # Check alternatives structure
        if candidate["skills_alternatives"]:
            alternative = candidate["skills_alternatives"][0]
            assert "jd_index" in alternative
            assert "items" in alternative
            assert len(alternative["items"]) <= 3  # Top 3 alternatives
    
    @patch('app.routes.special_routes.extract_jd')
    @patch('app.routes.special_routes.get_qdrant_utils')
    @patch('app.routes.special_routes.get_model')
    def test_match_with_jd_text_success(self, mock_get_model, mock_get_qdrant, 
                                       mock_extract_jd, client, mock_qdrant_utils, mock_embedding_model):
        """Test successful matching with JD text"""
        mock_get_qdrant.return_value = mock_qdrant_utils
        mock_get_model.return_value = mock_embedding_model
        
        # Mock JD extraction
        mock_extract_jd.return_value = {
            "job_title": "Python Developer",
            "years_of_experience": 3,
            "skills_sentences": ["Python", "Django"],
            "responsibility_sentences": ["Development", "Testing"]
        }
        
        payload = {
            "jd_text": "Looking for a Python developer with Django experience...",
            "top_alternatives": 2
        }
        
        response = client.post("/match", json=payload)
        
        assert response.status_code == 200
        data = response.json()
        
        # Should have extracted JD info
        assert data["jd_job_title"] == "Python Developer"
        assert data["jd_years"] == 3
        
        # Should have processed all CVs (no cv_ids specified)
        assert len(data["candidates"]) == 2
    
    def test_match_missing_jd_info(self, client):
        """Test error when neither jd_id nor jd_text provided"""
        payload = {
            "cv_ids": ["cv_1"]
        }
        
        response = client.post("/match", json=payload)
        
        assert response.status_code == 400
        assert "Provide jd_id or jd_text" in response.json()["detail"]
    
    @patch('app.routes.special_routes.get_qdrant_utils')
    def test_match_jd_not_found(self, mock_get_qdrant, client):
        """Test error when JD not found"""
        mock_qdrant = Mock()
        mock_qdrant.get_structured_jd.return_value = None
        mock_get_qdrant.return_value = mock_qdrant
        
        payload = {
            "jd_id": "nonexistent_jd"
        }
        
        response = client.post("/match", json=payload)
        
        assert response.status_code == 404
        assert "JD not found" in response.json()["detail"]
    
    @patch('app.routes.special_routes.get_qdrant_utils')
    def test_match_no_cvs_available(self, mock_get_qdrant, client):
        """Test error when no CVs available"""
        mock_qdrant = Mock()
        mock_qdrant.get_structured_jd.return_value = {
            "job_title": "Developer",
            "years_of_experience": 2,
            "skills_sentences": ["Python"],
            "responsibility_sentences": ["Coding"]
        }
        mock_qdrant.list_all_cvs.return_value = []
        mock_get_qdrant.return_value = mock_qdrant
        
        payload = {
            "jd_id": "jd_1"
        }
        
        response = client.post("/match", json=payload)
        
        assert response.status_code == 404
        assert "No CVs available for matching" in response.json()["detail"]
    
    @patch('app.routes.special_routes.get_qdrant_utils')
    @patch('app.routes.special_routes.get_model')
    def test_match_assignments_count(self, mock_get_model, mock_get_qdrant, 
                                    client, mock_qdrant_utils, mock_embedding_model):
        """Test that assignments count equals min(jd_items, cv_items)"""
        mock_get_qdrant.return_value = mock_qdrant_utils
        mock_get_model.return_value = mock_embedding_model
        
        payload = {
            "jd_id": "jd_1",
            "cv_ids": ["cv_1"]
        }
        
        response = client.post("/match", json=payload)
        
        assert response.status_code == 200
        data = response.json()
        
        candidate = data["candidates"][0]
        
        # Skills assignments should be min(3 JD skills, 3 CV skills) = 3
        assert len(candidate["skills_assignments"]) == 3
        
        # Responsibilities assignments should be min(3 JD resps, 3 CV resps) = 3  
        assert len(candidate["responsibilities_assignments"]) == 3
    
    @patch('app.routes.special_routes.get_qdrant_utils')
    @patch('app.routes.special_routes.get_model')
    def test_match_alternatives_exclude_assigned(self, mock_get_model, mock_get_qdrant,
                                                client, mock_qdrant_utils, mock_embedding_model):
        """Test that alternatives exclude assigned items"""
        mock_get_qdrant.return_value = mock_qdrant_utils
        mock_get_model.return_value = mock_embedding_model
        
        payload = {
            "jd_id": "jd_1", 
            "cv_ids": ["cv_1"],
            "top_alternatives": 2
        }
        
        response = client.post("/match", json=payload)
        
        assert response.status_code == 200
        data = response.json()
        
        candidate = data["candidates"][0]
        
        # Get assigned CV items
        assigned_skills = {a["cv_index"] for a in candidate["skills_assignments"]}
        assigned_resps = {a["cv_index"] for a in candidate["responsibilities_assignments"]}
        
        # Check that alternatives don't include assigned items
        for alt in candidate["skills_alternatives"]:
            jd_idx = alt["jd_index"]
            assigned_cv_idx = None
            for assignment in candidate["skills_assignments"]:
                if assignment["jd_index"] == jd_idx:
                    assigned_cv_idx = assignment["cv_index"]
                    break
            
            # None of the alternative items should be the assigned one
            alt_cv_indices = {item["cv_index"] for item in alt["items"]}
            if assigned_cv_idx is not None:
                assert assigned_cv_idx not in alt_cv_indices


if __name__ == "__main__":
    pytest.main([__file__])
