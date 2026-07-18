import React, { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useForm, useFieldArray } from 'react-hook-form';
import { ArrowLeft, Save, Trash2, Plus, AlertCircle, BarChart2, CheckCircle2, Play, Pause, Edit2 } from 'lucide-react';
import { apiClient } from '../api/client';
import { LoadingState, ErrorState } from '../components/States';

const toFormValues = (experiment) => ({
  key: experiment.key,
  status: experiment.status,
  hasContent: Boolean(experiment.variants?.some(variant => variant.content)),
  variants: experiment.variants?.map(variant => ({
    key: variant.key,
    allocation: variant.allocation,
    content: variant.content
  })) || []
});

export default function ExperimentDetail() {
  const { key } = useParams();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [originalExperiment, setOriginalExperiment] = useState(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [actionError, setActionError] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const { 
    register, 
    control, 
    handleSubmit, 
    watch, 
    reset,
    setError,
    clearErrors,
    formState: { errors, isSubmitting } 
  } = useForm({
    mode: 'all',
    defaultValues: {
      key: '',
      status: 'draft',
      hasContent: false,
      variants: []
    }
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'variants'
  });

  const activateMutation = useMutation({
    mutationFn: () => apiClient.activateExperiment(key),
    onSuccess: (data) => {
      queryClient.setQueryData(['experiment', key], data.experiment);
      setOriginalExperiment(data.experiment);
      reset(toFormValues(data.experiment));
      setActionError(null);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 5000);
      refetch();
    },
    onError: (err) => {
      setActionError(err.message || 'Failed to activate experiment.');
    }
  });

  const deactivateMutation = useMutation({
    mutationFn: () => apiClient.deactivateExperiment(key),
    onSuccess: (data) => {
      queryClient.setQueryData(['experiment', key], data.experiment);
      setOriginalExperiment(data.experiment);
      reset(toFormValues(data.experiment));
      setActionError(null);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 5000);
      refetch();
    },
    onError: (err) => {
      setActionError(err.message || 'Failed to deactivate experiment.');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: () => apiClient.deleteExperiment(key),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['experiments'] });
      navigate('/experiments');
    },
    onError: (err) => {
      setActionError(err.message || 'Failed to delete experiment.');
    }
  });

  const handleDelete = () => {
    if (window.confirm(`Are you sure you want to delete the experiment "${key}"? This action cannot be undone.`)) {
      deleteMutation.mutate();
    }
  };

  const { data: experiment, isLoading, error, refetch } = useQuery({
    queryKey: ['experiment', key],
    queryFn: () => apiClient.getExperiment(key),
    retry: false
  });

  const isDraft = experiment?.status === 'draft';

  // Load experiment details into form
  useEffect(() => {
    if (experiment) {
      reset(toFormValues(experiment));
      setOriginalExperiment(experiment);
    }
  }, [experiment, reset]);

  const watchedVariants = watch('variants') || [];
  const hasContent = watch('hasContent');

  // Calculate total allocations
  const totalAllocation = watchedVariants.reduce((acc, curr) => {
    const val = Number(curr.allocation);
    return acc + (isNaN(val) ? 0 : val);
  }, 0);

  // Validate uniqueness and values
  const variantKeys = watchedVariants.map(v => v.key?.trim() || '');
  const hasDuplicateKeys = variantKeys.some((k, idx) => k !== '' && variantKeys.indexOf(k) !== idx);
  
  const hasInvalidAllocations = watchedVariants.some(v => {
    const val = Number(v.allocation);
    return isNaN(val) || val <= 0 || !Number.isInteger(val);
  });

  const hasEmptyKeys = watchedVariants.some(v => !v.key || v.key.trim() === '');
  const hasEmptyContent = hasContent && watchedVariants.some(v => !v.content?.text || v.content.text.trim() === '');

  const isAllocationValid = totalAllocation === 100;
  const isVariantsCountValid = watchedVariants.length >= 2;
  const isFormValidLocally = isAllocationValid && isVariantsCountValid && !hasDuplicateKeys && !hasInvalidAllocations && !hasEmptyKeys && !hasEmptyContent;

  // Determine if allocations have changed compared to original loaded experiment
  const checkAllocationsChanged = () => {
    if (!originalExperiment || !originalExperiment.variants) return false;
    const orig = originalExperiment.variants;
    const curr = watchedVariants;
    if (orig.length !== curr.length) return true;

    for (const oVar of orig) {
      const cVar = curr.find(v => v.key?.trim() === oVar.key?.trim());
      if (!cVar) return true; // Key was removed/modified
      if (Number(cVar.allocation) !== Number(oVar.allocation)) return true; // Allocation was modified
    }
    return false;
  };

  const showAllocationWarning = checkAllocationsChanged();

  // Mutation to update experiment
  const mutation = useMutation({
    mutationFn: (payload) => apiClient.updateExperiment(key, payload),
    onSuccess: (data) => {
      queryClient.setQueryData(['experiment', key], data.experiment);
      setOriginalExperiment(data.experiment);
      setIsEditing(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 5000);
      refetch();
    },
    onError: (err) => {
      if (err.status === 400 && err.details?.message) {
        setError('root.serverError', { type: 'manual', message: err.details.message });
      } else {
        setError('root.serverError', { type: 'manual', message: err.message || 'Failed to update experiment.' });
      }
    }
  });

  const onSubmit = async (data) => {
    if (!isFormValidLocally) return;
    clearErrors();

    const payload = {
      status: data.status,
      variants: data.variants.map(v => {
        const variant = { key: v.key.trim(), allocation: Number(v.allocation) };
        if (data.hasContent) {
          variant.content = { type: 'static_text', text: v.content.text.trim() };
        }
        return variant;
      })
    };

    mutation.mutate(payload);
  };

  if (isLoading) return <LoadingState message="Loading experiment details..." />;
  if (error) {
    return (
      <ErrorState 
        title="Failed to Load Experiment Details" 
        description={error.message || 'Experiment could not be retrieved.'}
        onRetry={refetch}
      />
    );
  }

  return (
    <div>
      <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Link to="/experiments" className="btn btn-secondary btn-sm" style={{ display: 'inline-flex', gap: '0.25rem' }}>
          <ArrowLeft size={16} />
          <span>Back to List</span>
        </Link>
        
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          {!isEditing && (
            <>
              {isDraft && (
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="btn btn-primary btn-sm"
                  style={{ display: 'inline-flex', gap: '0.25rem', background: 'var(--accent-gradient)' }}
                  data-testid="edit-btn"
                >
                  <Edit2 size={16} />
                  <span>Edit Configuration</span>
                </button>
              )}

              <Link 
                to={`/experiments/${encodeURIComponent(key)}/results`} 
                className="btn btn-secondary btn-sm"
                style={{ display: 'inline-flex', gap: '0.25rem' }}
                data-testid="link-to-results"
              >
                <BarChart2 size={16} />
                <span>View Analytics</span>
              </Link>

              <div className="dropdown-container" style={{ position: 'relative' }}>
                <button
                  type="button"
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="btn btn-secondary btn-sm"
                  style={{ display: 'inline-flex', gap: '0.25rem', alignItems: 'center' }}
                  data-testid="actions-dropdown-toggle"
                >
                  <span>More Actions</span>
                  <span style={{ fontSize: '0.625rem', marginLeft: '2px' }}>▼</span>
                </button>

                {dropdownOpen && (
                  <>
                    <div 
                      style={{ position: 'fixed', top: 0, right: 0, bottom: 0, left: 0, zIndex: 998 }}
                      onClick={() => setDropdownOpen(false)}
                      data-testid="dropdown-overlay"
                    />
                    <div className="dropdown-menu" style={{ 
                      position: 'absolute', 
                      right: 0, 
                      top: 'calc(100% + 4px)', 
                      backgroundColor: 'var(--bg-secondary)', 
                      border: '1px solid var(--border-color)', 
                      borderRadius: 'var(--radius-sm)', 
                      padding: '4px',
                      boxShadow: 'var(--shadow-lg)',
                      minWidth: '160px',
                      zIndex: 999,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '2px'
                    }}>
                      {experiment?.status === 'active' ? (
                        <button
                          type="button"
                          onClick={() => {
                            deactivateMutation.mutate();
                            setDropdownOpen(false);
                          }}
                          disabled={deactivateMutation.isPending}
                          className="dropdown-item"
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            padding: '8px 12px',
                            background: 'none',
                            border: 'none',
                            color: 'var(--warning-color)',
                            textAlign: 'left',
                            width: '100%',
                            cursor: 'pointer',
                            borderRadius: '4px',
                            fontSize: '0.875rem'
                          }}
                          data-testid="deactivate-btn"
                        >
                          <Pause size={14} />
                          <span>Deactivate</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            activateMutation.mutate();
                            setDropdownOpen(false);
                          }}
                          disabled={activateMutation.isPending}
                          className="dropdown-item"
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            padding: '8px 12px',
                            background: 'none',
                            border: 'none',
                            color: 'var(--success-color)',
                            textAlign: 'left',
                            width: '100%',
                            cursor: 'pointer',
                            borderRadius: '4px',
                            fontSize: '0.875rem'
                          }}
                          data-testid="activate-btn"
                        >
                          <Play size={14} />
                          <span>Activate</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          handleDelete();
                          setDropdownOpen(false);
                        }}
                        disabled={deleteMutation.isPending}
                        className="dropdown-item danger"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                          padding: '8px 12px',
                          background: 'none',
                          border: 'none',
                          color: 'var(--danger-color)',
                          textAlign: 'left',
                          width: '100%',
                          cursor: 'pointer',
                          borderRadius: '4px',
                          fontSize: '0.875rem'
                        }}
                        data-testid="delete-btn"
                      >
                        <Trash2 size={14} />
                        <span>Delete</span>
                      </button>
                    </div>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      <h2 className="page-title" data-testid="detail-title">Experiment: {key}</h2>
      <p className="page-subtitle">Inspect configuration details and manage experiment status.</p>

      {!isDraft && (
        <div className="alert alert-warning" data-testid="immutable-config-guidance" style={{ marginBottom: '1.5rem' }}>
          <AlertCircle size={20} />
          <div className="alert-message">Variants and allocation are locked for this experiment. Create a new experiment key/version to change the configuration.</div>
        </div>
      )}

      {actionError && (
        <div className="alert alert-danger" data-testid="action-error-alert" style={{ marginBottom: '1.5rem' }}>
          <AlertCircle size={20} />
          <div className="alert-message">{actionError}</div>
        </div>
      )}

      {saveSuccess && (
        <div className="alert alert-success" data-testid="success-alert">
          <CheckCircle2 size={20} />
          <div className="alert-message">Experiment configuration saved successfully.</div>
        </div>
      )}

      {errors.root?.serverError && (
        <div className="alert alert-danger" data-testid="server-error-alert">
          <AlertCircle size={20} />
          <div className="alert-message">{errors.root.serverError.message}</div>
        </div>
      )}

      {showAllocationWarning && (
        <div className="alert alert-warning" data-testid="allocation-warning-alert">
          <AlertCircle size={20} />
          <div className="alert-message">
            Changing allocation may cause some visitors to receive a different variant.
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="panel-card" style={{ maxWidth: '700px' }} data-testid="edit-experiment-form">
        {/* Experiment Key (Read-only) */}
        <div className="form-group">
          <label className="form-label" htmlFor="experiment-key">Experiment Key</label>
          <input
            id="experiment-key"
            type="text"
            className="form-input"
            readOnly
            {...register('key')}
            data-testid="field-key"
          />
        </div>

        {/* Experiment Status */}
        <div className="form-group">
          <label className="form-label" htmlFor="experiment-status">Status</label>
          <select
            id="experiment-status"
            className="form-select"
            disabled
            {...register('status', { required: 'Status is required' })}
            data-testid="field-status"
          >
            <option value="draft">Draft</option>
            <option value="active">Active</option>
            <option value="paused">Paused</option>
            <option value="archived">Archived</option>
          </select>
        </div>

        {/* Variants Section */}
        <div style={{ marginTop: '2rem' }}>
          <div className="form-group">
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input
                type="checkbox"
                disabled={!isEditing}
                {...register('hasContent')}
                data-testid="content-enabled-checkbox"
              />
              Return plain-text content with each assignment
            </label>
          </div>
          <div className="variants-container-header">
            <h3 style={{ fontSize: '1.125rem', fontFamily: 'var(--font-display)', fontWeight: 600 }}>
              Variants Configuration
            </h3>
             <button
              type="button"
              className="btn btn-secondary btn-sm"
              style={{ padding: '0.375rem 0.75rem', display: isEditing ? 'inline-flex' : 'none' }}
              onClick={() => append({ key: '', allocation: 0, content: hasContent ? { type: 'static_text', text: '' } : undefined })}
              data-testid="add-variant-btn"
            >
              <Plus size={16} />
              <span>Add Variant</span>
            </button>
          </div>

          {!isVariantsCountValid && (
            <p className="form-error" style={{ marginBottom: '1rem' }} data-testid="error-variants-count">
              An experiment must have at least two variants.
            </p>
          )}

          {hasDuplicateKeys && (
            <p className="form-error" style={{ marginBottom: '1rem' }} data-testid="error-duplicate-keys">
              Variant keys must be unique.
            </p>
          )}

          {hasInvalidAllocations && (
            <p className="form-error" style={{ marginBottom: '1rem' }} data-testid="error-invalid-allocations">
              Allocations must be positive integers.
            </p>
          )}

          {hasEmptyContent && (
            <p className="form-error" style={{ marginBottom: '1rem' }} data-testid="error-empty-content">
              Content is required for every variant.
            </p>
          )}

          {/* Variants Rows */}
          {fields.map((field, index) => (
            <div key={field.id} className="variant-row" data-testid={`variant-row-${index}`}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontSize: '0.8125rem' }}>Variant Key</label>
                <input
                  type="text"
                  placeholder="e.g. treatment_red"
                  className="form-input"
                  disabled={!isEditing}
                  {...register(`variants.${index}.key`, { required: 'Variant key is required' })}
                  data-testid={`variant-key-input-${index}`}
                />
              </div>

              {hasContent && (
                <div className="form-group" style={{ margin: 0, gridColumn: '1 / -1' }}>
                  <label className="form-label" style={{ fontSize: '0.8125rem' }}>Plain Text Content</label>
                  <textarea
                    placeholder="Text returned when this variant is assigned"
                    className="form-input"
                    rows={3}
                    disabled={!isEditing}
                    {...register(`variants.${index}.content.text`)}
                    data-testid={`variant-content-input-${index}`}
                  />
                </div>
              )}

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontSize: '0.8125rem' }}>Traffic Allocation (%)</label>
                <input
                  type="number"
                  placeholder="0"
                  className="form-input"
                  disabled={!isEditing}
                  {...register(`variants.${index}.allocation`, { 
                    required: 'Allocation is required',
                    valueAsNumber: true
                  })}
                  data-testid={`variant-allocation-input-${index}`}
                />
              </div>

              {isEditing && (
                <button
                  type="button"
                  className="btn btn-danger"
                  style={{ alignSelf: 'end', padding: '0.75rem' }}
                  onClick={() => remove(index)}
                  disabled={fields.length <= 2}
                  title="Remove variant"
                  data-testid={`remove-variant-btn-${index}`}
                >
                  <Trash2 size={18} />
                </button>
              )}
            </div>
          ))}

          {/* Allocation Total Indicator */}
          <div 
            className={`allocation-total-bar ${isAllocationValid ? 'success' : 'error'}`}
            data-testid="allocation-total-bar"
          >
            <span>Total Allocation:</span>
            <span>{totalAllocation}% / 100%</span>
          </div>
          {!isAllocationValid && (
            <p className="form-error" style={{ marginTop: '0.5rem' }} data-testid="error-allocation-sum">
              The allocations of all variants must total exactly 100%.
            </p>
          )}
        </div>

        {/* Submission Panel */}
        {isEditing && (
          <div style={{ marginTop: '2.5rem', display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                if (originalExperiment) {
                  reset(toFormValues(originalExperiment));
                }
                setIsEditing(false);
                clearErrors();
              }}
              data-testid="cancel-edit-btn"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={!isFormValidLocally || isSubmitting}
              data-testid="submit-btn"
            >
              <Save size={18} />
              <span>{isSubmitting ? 'Saving...' : 'Save Configuration'}</span>
            </button>
          </div>
        )}
      </form>
    </div>
  );
}
