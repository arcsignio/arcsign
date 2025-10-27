package models

import "time"

// GenerationMetrics tracks address generation performance metrics
type GenerationMetrics struct {
	TotalChains     int                   `json:"total_chains"`
	SuccessCount    int                   `json:"success_count"`
	FailureCount    int                   `json:"failure_count"`
	RetryCount      int                   `json:"retry_count"`
	TotalDuration   time.Duration         `json:"total_duration"`
	PerChainMetrics map[string]ChainMetric `json:"per_chain_metrics"`
}

// ChainMetric tracks metrics for a single blockchain
type ChainMetric struct {
	Symbol       string        `json:"symbol"`
	Success      bool          `json:"success"`
	Duration     time.Duration `json:"duration"`
	Attempts     int           `json:"attempts"`
	ErrorMessage string        `json:"error_message,omitempty"`
}

// SuccessRate calculates the success percentage
func (m *GenerationMetrics) SuccessRate() float64 {
	if m.TotalChains == 0 {
		return 0.0
	}
	return (float64(m.SuccessCount) / float64(m.TotalChains)) * 100.0
}
