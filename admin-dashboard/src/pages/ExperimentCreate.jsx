import React from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { useNavigate, Link } from 'react-router-dom';
import { Plus, Trash2, Save, ArrowLeft, AlertCircle } from 'lucide-react';
import { apiClient } from '../api/client';

export default function ExperimentCreate() {
  const navigate = useNavigate();
  
  const { 
    register, 
    control, 
    handleSubmit, 
    watch, 
    setError,
    formState: { errors, isSubmitting } 
  } = useForm({
    mode: 'all',
    defaultValues: {
      key: '',
      status: 'draft',
      variants: [
        { key: 'control', allocation: 50 },
        { key: 'treatment', allocation: 50 }
      ]
    }
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'variants'
  });

  const watchedVariants = watch('variants') || [];
  
  // Calculate total allocations
  const totalAllocation = watchedVariants.reduce((acc, curr) => {
    const val = Number(curr.allocation);
    return acc + (isNaN(val) ? 0 : val);
  }, 0);

  // Validate variant key uniqueness
  const variantKeys = watchedVariants.map(v => v.key?.trim() || '');
  const hasDuplicateKeys = variantKeys.some((k, idx) => k !== '' && variantKeys.indexOf(k) !== idx);
  
  // Check if allocations are positive integers
  const hasInvalidAllocations = watchedVariants.some(v => {
    const val = Number(v.allocation);
    return isNaN(val) || val <= 0 || !Number.isInteger(val);
  });

  // Check if any variant key is empty
  const hasEmptyKeys = watchedVariants.some(v => !v.key || v.key.trim() === '');

  // Form isValid determination
  const isAllocationValid = totalAllocation === 100;
  const isVariantsCountValid = watchedVariants.length >= 2;
  const isFormValidLocally = isAllocationValid && isVariantsCountValid && !hasDuplicateKeys && !hasInvalidAllocations && !hasEmptyKeys;

  const onSubmit = async (data) => {
    if (!isFormValidLocally) return;

    // Clean payloads
    const payload = {
      key: data.key.trim(),
      status: data.status,
      variants: data.variants.map(v => ({
        key: v.key.trim(),
        allocation: Number(v.allocation)
      }))
    };

    try {
      const response = await apiClient.createExperiment(payload);
      if (response && response.status === 'success') {
        navigate(`/experiments/${encodeURIComponent(response.experiment.key)}`);
      }
    } catch (err) {
      if (err.errorCode === 'duplicate_key' || err.status === 409) {
        setError('key', { type: 'manual', message: 'An experiment with this key already exists.' });
      } else if (err.status === 400 && err.details?.message) {
        setError('root.serverError', { type: 'manual', message: err.details.message });
      } else {
        setError('root.serverError', { type: 'manual', message: err.message || 'Failed to create experiment.' });
      }
    }
  };

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <Link to="/experiments" className="btn btn-secondary btn-sm" style={{ display: 'inline-flex', gap: '0.25rem' }}>
          <ArrowLeft size={16} />
          <span>Back to List</span>
        </Link>
      </div>

      <h2 className="page-title">Create Experiment</h2>
      <p className="page-subtitle">Configure a new experiment segment and traffic variables</p>

      {errors.root?.serverError && (
        <div className="alert alert-danger" data-testid="server-error-alert">
          <AlertCircle size={20} />
          <div className="alert-message">{errors.root.serverError.message}</div>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="panel-card" style={{ maxWidth: '700px' }} data-testid="create-experiment-form">
        {/* Experiment Key */}
        <div className="form-group">
          <label className="form-label" htmlFor="experiment-key">Experiment Key</label>
          <input
            id="experiment-key"
            type="text"
            className="form-input"
            placeholder="e.g. checkout_button_color"
            {...register('key', { 
              required: 'Experiment key is required',
              pattern: {
                value: /^[a-zA-Z0-9_]+$/,
                message: 'Experiment key must be alphanumeric or underscores'
              }
            })}
            data-testid="field-key"
          />
          {errors.key && (
            <p className="form-error" data-testid="error-key">{errors.key.message}</p>
          )}
        </div>

        {/* Experiment Status */}
        <div className="form-group">
          <label className="form-label" htmlFor="experiment-status">Status</label>
          <select
            id="experiment-status"
            className="form-select"
            {...register('status', { required: 'Status is required' })}
            data-testid="field-status"
          >
            <option value="draft">Draft</option>
            <option value="active">Active</option>
            <option value="paused">Paused</option>
            <option value="archived">Archived</option>
          </select>
          {errors.status && (
            <p className="form-error">{errors.status.message}</p>
          )}
        </div>

        {/* Variants Section */}
        <div style={{ marginTop: '2rem' }}>
          <div className="variants-container-header">
            <h3 style={{ fontSize: '1.125rem', fontFamily: 'var(--font-display)', fontWeight: 600 }}>
              Variants Configuration
            </h3>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              style={{ padding: '0.375rem 0.75rem' }}
              onClick={() => append({ key: '', allocation: 0 })}
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

          {/* Variants Rows */}
          {fields.map((field, index) => (
            <div key={field.id} className="variant-row" data-testid={`variant-row-${index}`}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontSize: '0.8125rem' }}>Variant Key</label>
                <input
                  type="text"
                  placeholder="e.g. treatment_red"
                  className="form-input"
                  {...register(`variants.${index}.key`, { required: 'Variant key is required' })}
                  data-testid={`variant-key-input-${index}`}
                />
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontSize: '0.8125rem' }}>Traffic Allocation (%)</label>
                <input
                  type="number"
                  placeholder="0"
                  className="form-input"
                  {...register(`variants.${index}.allocation`, { 
                    required: 'Allocation is required',
                    valueAsNumber: true
                  })}
                  data-testid={`variant-allocation-input-${index}`}
                />
              </div>

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
        <div style={{ marginTop: '2.5rem', display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
          <Link to="/experiments" className="btn btn-secondary">
            Cancel
          </Link>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={!isFormValidLocally || isSubmitting}
            data-testid="submit-btn"
          >
            <Save size={18} />
            <span>{isSubmitting ? 'Creating...' : 'Create Experiment'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
