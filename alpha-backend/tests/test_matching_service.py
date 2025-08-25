"""
Unit tests for matching service functions
"""
import pytest
import numpy as np
from app.services.matching_service import normalize_weights, years_score, hungarian_mean


class TestNormalizeWeights:
    """Test weight normalization function"""
    
    def test_normalize_weights_normal_case(self):
        """Test normal weight normalization"""
        weights = {"skills": 80, "responsibilities": 15, "job_title": 2.5, "experience": 2.5}
        result = normalize_weights(weights)
        
        # Should sum to 1.0
        assert abs(sum(result.values()) - 1.0) < 1e-10
        
        # Should maintain proportions
        assert abs(result["skills"] - 0.8) < 1e-10
        assert abs(result["responsibilities"] - 0.15) < 1e-10
        assert abs(result["job_title"] - 0.025) < 1e-10
        assert abs(result["experience"] - 0.025) < 1e-10
    
    def test_normalize_weights_zero_total(self):
        """Test fallback when total weight is zero"""
        weights = {"skills": 0, "responsibilities": 0, "job_title": 0, "experience": 0}
        result = normalize_weights(weights)
        
        # Should return equal weights
        assert result == {"skills": 0.25, "responsibilities": 0.25, "job_title": 0.25, "experience": 0.25}
    
    def test_normalize_weights_negative_total(self):
        """Test fallback when total weight is negative"""
        weights = {"skills": -10, "responsibilities": -5, "job_title": -2, "experience": -3}
        result = normalize_weights(weights)
        
        # Should return equal weights
        assert result == {"skills": 0.25, "responsibilities": 0.25, "job_title": 0.25, "experience": 0.25}


class TestYearsScore:
    """Test experience years scoring function"""
    
    def test_years_score_jd_zero(self):
        """Test when JD requires 0 years - should return 1.0"""
        assert years_score(0, 5) == 1.0
        assert years_score(0, 0) == 1.0
    
    def test_years_score_cv_meets_requirement(self):
        """Test when CV meets or exceeds requirement"""
        assert years_score(5, 5) == 1.0
        assert years_score(5, 7) == 1.0
        assert years_score(3, 10) == 1.0
    
    def test_years_score_cv_below_requirement(self):
        """Test when CV is below requirement"""
        assert years_score(10, 5) == 0.5
        assert years_score(4, 2) == 0.5
        assert abs(years_score(6, 3) - 0.5) < 1e-10
    
    def test_years_score_edge_cases(self):
        """Test edge cases"""
        assert years_score(1, 0) == 0.0
        assert years_score(100, 50) == 0.5


class TestHungarianMean:
    """Test Hungarian algorithm implementation"""
    
    def test_hungarian_mean_empty_matrix(self):
        """Test with empty similarity matrix"""
        sim_matrix = np.array([])
        score, pairs = hungarian_mean(sim_matrix)
        
        assert score == 0.0
        assert pairs == []
    
    def test_hungarian_mean_single_element(self):
        """Test with single element matrix"""
        sim_matrix = np.array([[0.8]])
        score, pairs = hungarian_mean(sim_matrix)
        
        assert abs(score - 0.8) < 1e-10
        assert len(pairs) == 1
        assert pairs[0] == (0, 0, 0.8)
    
    def test_hungarian_mean_square_matrix(self):
        """Test with square similarity matrix"""
        # Create a known matrix where optimal assignment is clear
        sim_matrix = np.array([
            [0.9, 0.1, 0.2],  # Row 0 best matches Col 0
            [0.2, 0.8, 0.3],  # Row 1 best matches Col 1  
            [0.1, 0.3, 0.7]   # Row 2 best matches Col 2
        ])
        
        score, pairs = hungarian_mean(sim_matrix)
        
        # Should find optimal assignment
        expected_score = (0.9 + 0.8 + 0.7) / 3
        assert abs(score - expected_score) < 1e-10
        
        # Should have 3 pairs
        assert len(pairs) == 3
        
        # Check that each row and column is assigned exactly once
        rows = [p[0] for p in pairs]
        cols = [p[1] for p in pairs]
        assert sorted(rows) == [0, 1, 2]
        assert sorted(cols) == [0, 1, 2]
    
    def test_hungarian_mean_rectangular_matrix(self):
        """Test with rectangular similarity matrix"""
        # More CVs than JD requirements
        sim_matrix = np.array([
            [0.9, 0.7, 0.3, 0.2],  # JD skill 0
            [0.4, 0.8, 0.6, 0.1]   # JD skill 1
        ])
        
        score, pairs = hungarian_mean(sim_matrix)
        
        # Should assign 2 pairs (limited by number of JD requirements)
        assert len(pairs) == 2
        
        # Should find optimal assignment: (0,0) and (1,1) with scores 0.9 and 0.8
        expected_score = (0.9 + 0.8) / 2
        assert abs(score - expected_score) < 1e-10
        
        # Check assignments
        pair_dict = {p[0]: (p[1], p[2]) for p in pairs}
        assert pair_dict[0] == (0, 0.9)
        assert pair_dict[1] == (1, 0.8)
    
    def test_hungarian_mean_all_zeros(self):
        """Test with all-zero similarity matrix"""
        sim_matrix = np.array([
            [0.0, 0.0],
            [0.0, 0.0]
        ])
        
        score, pairs = hungarian_mean(sim_matrix)
        
        assert score == 0.0
        assert len(pairs) == 2
        for pair in pairs:
            assert pair[2] == 0.0  # All scores should be 0
    
    def test_hungarian_mean_perfect_matches(self):
        """Test with perfect similarity matrix"""
        sim_matrix = np.array([
            [1.0, 0.0],
            [0.0, 1.0]
        ])
        
        score, pairs = hungarian_mean(sim_matrix)
        
        assert score == 1.0
        assert len(pairs) == 2
        
        # Should assign perfectly
        pair_dict = {p[0]: (p[1], p[2]) for p in pairs}
        assert pair_dict[0] == (0, 1.0)
        assert pair_dict[1] == (1, 1.0)


if __name__ == "__main__":
    pytest.main([__file__])
