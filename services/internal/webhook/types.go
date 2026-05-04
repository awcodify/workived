package webhook

// Railway event type constants.
const (
	// Deployment events
	EventDeploymentCrashed      = "Deployment.Crashed"
	EventDeploymentOomKilled    = "Deployment.OomKilled"
	EventDeploymentFailed       = "Deployment.Failed"
	EventDeploymentDeployed     = "Deployment.Deployed"
	EventDeploymentRedeployed   = "Deployment.Redeployed"
	EventDeploymentSlept        = "Deployment.Slept"
	EventDeploymentResumed      = "Deployment.Resumed"
	EventDeploymentRestarted    = "Deployment.Restarted"
	EventDeploymentRemoved      = "Deployment.Removed"
	EventDeploymentBuilding     = "Deployment.Building"
	EventDeploymentDeploying    = "Deployment.Deploying"
	EventDeploymentWaiting      = "Deployment.Waiting"
	EventDeploymentNeedsApproval = "Deployment.NeedsApproval"
	EventDeploymentQueued       = "Deployment.Queued"

	// Monitor events
	EventMonitorTriggered = "Monitor.Triggered"
	EventMonitorResolved  = "Monitor.Resolved"
	EventMonitorDeleted   = "Monitor.Deleted"

	// VolumeAlert events
	EventVolumeAlertTriggered = "VolumeAlert.Triggered"
	EventVolumeAlertResolved  = "VolumeAlert.Resolved"
)

// RailwayPayload is the top-level structure for all Railway webhook events.
type RailwayPayload struct {
	Type      string          `json:"type"`
	Details   RailwayDetails  `json:"details"`
	Resource  RailwayResource `json:"resource"`
	Severity  string          `json:"severity"`
	Timestamp string          `json:"timestamp"`
}

type RailwayDetails struct {
	ID            string `json:"id"`
	Source        string `json:"source"`
	Status        string `json:"status"`
	Branch        string `json:"branch"`
	CommitHash    string `json:"commitHash"`
	CommitAuthor  string `json:"commitAuthor"`
	CommitMessage string `json:"commitMessage"`
}

type RailwayResource struct {
	Workspace   RailwayWorkspace   `json:"workspace"`
	Project     RailwayProject     `json:"project"`
	Environment RailwayEnvironment `json:"environment"`
	Service     RailwayService     `json:"service"`
	Deployment  RailwayDeployment  `json:"deployment"`
}

type RailwayWorkspace struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

type RailwayProject struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

type RailwayEnvironment struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	IsEphemeral bool   `json:"isEphemeral"`
}

type RailwayService struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

type RailwayDeployment struct {
	ID string `json:"id"`
}
