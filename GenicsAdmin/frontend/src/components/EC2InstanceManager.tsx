import React, { useState, useEffect } from 'react';
import { useAuth } from 'react-oidc-context';
import { getConfig } from '../utils/config';

// EC2 instance type definition
interface EC2Instance {
  instanceId: string;
  state: string;
  type: string;
  launchTime?: Date;
  publicIpAddress?: string;
  privateIpAddress?: string;
  tags?: Record<string, string>;
}

const EC2InstanceManager: React.FC = () => {
  const [instances, setInstances] = useState<EC2Instance[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [actionInProgress, setActionInProgress] = useState<Record<string, boolean>>({});
  
  const auth = useAuth();
  const config = getConfig();

  // Fetch instances on component mount
  useEffect(() => {
    fetchInstances();
  }, []);

  // Fetch EC2 instances from API
  const fetchInstances = async () => {
    // Make sure we have an ID token for authentication
    if (!auth.user?.id_token) {
      setError('No ID token available for authentication');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`${config.ApiEndpoint}instances/`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${auth.user.id_token}`,
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`API request failed with status ${response.status}`);
      }

      const data = await response.json();
      setInstances(data.instances || []);
      setError(null);
    } catch (err) {
      setError(`Error fetching instances: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoading(false);
    }
  };

  // Change instance state (start/stop)
  const changeInstanceState = async (instanceId: string, action: 'start' | 'stop') => {
    // Make sure we have an ID token for authentication
    if (!auth.user?.id_token) {
      setError('No ID token available for authentication');
      return;
    }

    // Mark this instance as having an action in progress
    setActionInProgress(prev => ({ ...prev, [instanceId]: true }));

    try {
      const response = await fetch(`${config.ApiEndpoint}instances/`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${auth.user.id_token}`,
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          instanceId,
          action,
        }),
      });

      if (!response.ok) {
        throw new Error(`API request failed with status ${response.status}`);
      }

      // Refresh the instance list after a short delay
      setTimeout(() => {
        fetchInstances();
      }, 2000);
    } catch (err) {
      setError(`Error changing instance state: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      // Clear the action in progress flag after a delay
      setTimeout(() => {
        setActionInProgress(prev => ({ ...prev, [instanceId]: false }));
      }, 2000);
    }
  };

  // Get action button text based on instance state
  const getActionButtonText = (state?: string) => {
    if (state === 'running') return 'Stop';
    if (state === 'stopped') return 'Start';
    return 'Loading...';
  };

  // Get appropriate action based on current state
  const getActionForState = (state?: string): 'start' | 'stop' | null => {
    if (state === 'running') return 'stop';
    if (state === 'stopped') return 'start';
    return null;
  };

  // Get CSS class for state badge
  const getStateBadgeClass = (state?: string) => {
    switch (state) {
      case 'running':
        return 'status-badge running';
      case 'stopped':
        return 'status-badge stopped';
      case 'pending':
      case 'stopping':
        return 'status-badge transitioning';
      default:
        return 'status-badge unknown';
    }
  };

  return (
    <div className="ec2-instance-manager">
      <h2>EC2 Instance Manager</h2>
      
      {error && (
        <div className="error-message">
          {error}
          <button onClick={() => setError(null)}>Dismiss</button>
        </div>
      )}
      
      <div className="action-bar">
        <button onClick={fetchInstances} disabled={loading}>
          {loading ? 'Refreshing...' : 'Refresh Instances'}
        </button>
      </div>
      
      {loading ? (
        <div className="loading">Loading instances...</div>
      ) : (
        <div className="instances-container">
          {instances.length === 0 ? (
            <div className="no-instances">No instances found</div>
          ) : (
            <table className="instances-table">
              <thead>
                <tr>
                  <th>Instance ID</th>
                  <th>Name</th>
                  <th>Type</th>
                  <th>State</th>
                  <th>IP Address</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {instances.map((instance) => {
                  const actionType = getActionForState(instance.state);
                  const isActionDisabled = 
                    actionInProgress[instance.instanceId] || 
                    instance.state === 'pending' || 
                    instance.state === 'stopping' ||
                    !actionType;
                    
                  return (
                    <tr key={instance.instanceId}>
                      <td>{instance.instanceId}</td>
                      <td>{instance.tags?.Name || '-'}</td>
                      <td>{instance.type}</td>
                      <td>
                        <span className={getStateBadgeClass(instance.state)}>
                          {instance.state}
                        </span>
                      </td>
                      <td>{instance.publicIpAddress || instance.privateIpAddress || '-'}</td>
                      <td>
                        <button
                          onClick={() => actionType && changeInstanceState(instance.instanceId, actionType)}
                          disabled={isActionDisabled}
                        >
                          {actionInProgress[instance.instanceId]
                            ? actionType === 'start' ? 'Starting...' : 'Stopping...'
                            : getActionButtonText(instance.state)}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
};

export default EC2InstanceManager;
