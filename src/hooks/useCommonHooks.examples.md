# Common Hooks Usage Examples

This document shows practical examples of using the shared hooks from `useCommonHooks.js`.

---

## useModal

Manages modal open/close state with optional data passing.

### Example 1: Basic Modal Open/Close

```jsx
import { useModal } from '@/hooks';

const RecordsList = () => {
    const addModal = useModal();

    return (
        <div>
            <button onClick={addModal.open}>
                Add Record
            </button>

            {addModal.isOpen && (
                <AddRecordModal onClose={addModal.close} />
            )}
        </div>
    );
};
```

### Example 2: Modal with Data (Edit Item)

Use `openWith(data)` to pass data to the modal, then access it via `modal.data`.

```jsx
import { useModal } from '@/hooks';

const ContractorsList = ({ contractors }) => {
    const editModal = useModal();

    return (
        <div>
            {contractors.map(contractor => (
                <div key={contractor.id}>
                    <span>{contractor.name}</span>
                    <button onClick={() => editModal.openWith(contractor)}>
                        Edit
                    </button>
                </div>
            ))}

            {editModal.isOpen && (
                <EditContractorModal
                    contractor={editModal.data}
                    onClose={editModal.close}
                    onSave={(updated) => {
                        saveContractor(updated);
                        editModal.close();
                    }}
                />
            )}
        </div>
    );
};
```

### Example 3: Multiple Modals in One Component

Each modal gets its own hook instance with independent state.

```jsx
import { useModal } from '@/hooks';

const PropertySettings = ({ property }) => {
    const editModal = useModal();
    const deleteModal = useModal();
    const shareModal = useModal();

    return (
        <div>
            <h2>{property.name}</h2>

            <div className="flex gap-2">
                <button onClick={editModal.open}>Edit</button>
                <button onClick={shareModal.open}>Share</button>
                <button onClick={() => deleteModal.openWith(property)}>Delete</button>
            </div>

            {editModal.isOpen && (
                <EditPropertyModal property={property} onClose={editModal.close} />
            )}

            {shareModal.isOpen && (
                <SharePropertyModal property={property} onClose={shareModal.close} />
            )}

            {deleteModal.isOpen && (
                <DeleteConfirmModal
                    item={deleteModal.data}
                    onClose={deleteModal.close}
                />
            )}
        </div>
    );
};
```

---

## useAsyncAction

Wraps async operations with loading/error state and optional toast notifications.

### Example 1: Simple Save with Success Toast

```jsx
import { useAsyncAction } from '@/hooks';
import { updateRecord } from '@/lib/recordService';

const RecordEditor = ({ record, onClose }) => {
    const [formData, setFormData] = useState(record);

    const saveAction = useAsyncAction(
        async (data) => {
            await updateRecord(record.id, data);
        },
        {
            successMessage: 'Record saved successfully!',
            onSuccess: () => onClose()
        }
    );

    return (
        <form onSubmit={(e) => {
            e.preventDefault();
            saveAction.execute(formData);
        }}>
            <input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />

            <button type="submit" disabled={saveAction.loading}>
                {saveAction.loading ? 'Saving...' : 'Save'}
            </button>
        </form>
    );
};
```

### Example 2: Delete with Error Handling

```jsx
import { useAsyncAction } from '@/hooks';
import { deleteJob } from '@/features/jobs/lib/jobService';

const JobCard = ({ job, onDeleted }) => {
    const deleteAction = useAsyncAction(
        async () => {
            await deleteJob(job.id);
        },
        {
            successMessage: 'Job deleted',
            errorMessage: 'Failed to delete job. Please try again.',
            onSuccess: () => onDeleted(job.id),
            onError: (err) => console.error('Delete failed:', err)
        }
    );

    return (
        <div className="job-card">
            <h3>{job.title}</h3>

            <button
                onClick={() => deleteAction.execute()}
                disabled={deleteAction.loading}
                className="text-red-600"
            >
                {deleteAction.loading ? 'Deleting...' : 'Delete'}
            </button>

            {deleteAction.error && (
                <p className="text-red-500 text-sm mt-2">
                    {deleteAction.error.message}
                    <button onClick={deleteAction.reset} className="ml-2 underline">
                        Dismiss
                    </button>
                </p>
            )}
        </div>
    );
};
```

### Example 3: Chaining with useModal (Save then Close)

```jsx
import { useModal, useAsyncAction } from '@/hooks';
import { createQuote } from '@/features/quotes/lib/quoteService';

const QuotesList = () => {
    const createModal = useModal();

    const createAction = useAsyncAction(
        async (quoteData) => {
            const newQuote = await createQuote(quoteData);
            return newQuote;
        },
        {
            successMessage: 'Quote created!',
            onSuccess: () => createModal.close()  // Auto-close on success
        }
    );

    return (
        <div>
            <button onClick={createModal.open}>New Quote</button>

            {createModal.isOpen && (
                <CreateQuoteModal
                    onClose={createModal.close}
                    onSubmit={(data) => createAction.execute(data)}
                    loading={createAction.loading}
                />
            )}
        </div>
    );
};
```

---

## useConfirmAction

Wraps destructive actions with a confirmation step. Pairs with `ConfirmDialog` component.

### Example 1: Delete Confirmation with ConfirmDialog

```jsx
import { useConfirmAction } from '@/hooks';
import { ConfirmDialog } from '@/components/common';
import { deleteMembership } from '@/features/memberships/lib/membershipService';

const MembershipCard = ({ membership, contractorId, onDeleted }) => {
    const deleteAction = useConfirmAction(
        async (membership) => {
            await deleteMembership(contractorId, membership.id);
            onDeleted(membership.id);
        },
        {
            title: 'Cancel Membership?',
            message: `This will cancel ${membership.customerName}'s membership. They will lose access to member benefits.`,
            confirmText: 'Cancel Membership',
            cancelText: 'Keep Active',
            variant: 'danger'
        }
    );

    return (
        <div className="membership-card">
            <h3>{membership.customerName}</h3>
            <p>{membership.planName}</p>

            <button
                onClick={() => deleteAction.trigger(membership)}
                className="text-red-600"
            >
                Cancel Membership
            </button>

            {/* Confirmation Dialog */}
            {deleteAction.isConfirming && (
                <ConfirmDialog
                    isOpen={deleteAction.isConfirming}
                    onConfirm={deleteAction.confirm}
                    onCancel={deleteAction.cancel}
                    loading={deleteAction.loading}
                    {...deleteAction.config}
                />
            )}
        </div>
    );
};
```

### Example 2: Custom Confirmation Content

Use the `children` prop for custom dialog content.

```jsx
import { useConfirmAction } from '@/hooks';
import { ConfirmDialog } from '@/components/common';
import { removeContractorFromProperty } from '@/lib/contractorService';

const ContractorCard = ({ contractor, propertyId, onRemoved }) => {
    const removeAction = useConfirmAction(
        async (contractor) => {
            await removeContractorFromProperty(propertyId, contractor.id);
            onRemoved(contractor.id);
        },
        {
            title: 'Remove Contractor?',
            confirmText: 'Remove',
            variant: 'warning'
        }
    );

    return (
        <div>
            <span>{contractor.businessName}</span>
            <button onClick={() => removeAction.trigger(contractor)}>
                Remove
            </button>

            {removeAction.isConfirming && (
                <ConfirmDialog
                    isOpen={removeAction.isConfirming}
                    onConfirm={removeAction.confirm}
                    onCancel={removeAction.cancel}
                    loading={removeAction.loading}
                    title={removeAction.config.title}
                    confirmText={removeAction.config.confirmText}
                    variant={removeAction.config.variant}
                >
                    {/* Custom content instead of message prop */}
                    <div className="space-y-3">
                        <p>
                            <strong>{removeAction.pendingData?.businessName}</strong> will
                            no longer have access to this property.
                        </p>
                        <ul className="text-sm text-slate-500 list-disc list-inside">
                            <li>Past work history will be preserved</li>
                            <li>You can re-add them anytime</li>
                            <li>Pending jobs will need reassignment</li>
                        </ul>
                    </div>
                </ConfirmDialog>
            )}
        </div>
    );
};
```

---

## useFormState

Simple form state management with validation.

### Example 1: Simple Form with Validation

```jsx
import { useFormState } from '@/hooks';

const ContactForm = ({ onSubmit }) => {
    const form = useFormState(
        { name: '', email: '', message: '' },
        (values) => {
            const errors = {};
            if (!values.name.trim()) {
                errors.name = 'Name is required';
            }
            if (!values.email.trim()) {
                errors.email = 'Email is required';
            } else if (!/\S+@\S+\.\S+/.test(values.email)) {
                errors.email = 'Please enter a valid email';
            }
            if (!values.message.trim()) {
                errors.message = 'Message is required';
            }
            return errors;
        }
    );

    const handleSubmit = (e) => {
        e.preventDefault();
        if (form.validate()) {
            onSubmit(form.values);
            form.reset();
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div>
                <label>Name</label>
                <input
                    name="name"
                    value={form.values.name}
                    onChange={form.handleChange}
                    onBlur={form.handleBlur}
                    className={form.touched.name && form.errors.name ? 'border-red-500' : ''}
                />
                {form.touched.name && form.errors.name && (
                    <p className="text-red-500 text-sm">{form.errors.name}</p>
                )}
            </div>

            <div>
                <label>Email</label>
                <input
                    name="email"
                    type="email"
                    value={form.values.email}
                    onChange={form.handleChange}
                    onBlur={form.handleBlur}
                    className={form.touched.email && form.errors.email ? 'border-red-500' : ''}
                />
                {form.touched.email && form.errors.email && (
                    <p className="text-red-500 text-sm">{form.errors.email}</p>
                )}
            </div>

            <div>
                <label>Message</label>
                <textarea
                    name="message"
                    value={form.values.message}
                    onChange={form.handleChange}
                    onBlur={form.handleBlur}
                />
                {form.touched.message && form.errors.message && (
                    <p className="text-red-500 text-sm">{form.errors.message}</p>
                )}
            </div>

            <div className="flex gap-3">
                <button type="submit" disabled={!form.isValid}>
                    Send Message
                </button>
                <button type="button" onClick={() => form.reset()} disabled={!form.isDirty}>
                    Reset
                </button>
            </div>
        </form>
    );
};
```

### Example 2: Form with Async Submit (Combined with useAsyncAction)

```jsx
import { useFormState, useAsyncAction } from '@/hooks';
import { ButtonLoader } from '@/components/common';
import { createServicePlan } from '@/features/memberships/lib/membershipService';

const CreatePlanForm = ({ contractorId, onSuccess, onCancel }) => {
    const form = useFormState(
        {
            name: '',
            price: '',
            interval: 'monthly',
            description: ''
        },
        (values) => {
            const errors = {};
            if (!values.name.trim()) errors.name = 'Plan name is required';
            if (!values.price || values.price <= 0) errors.price = 'Price must be greater than 0';
            return errors;
        }
    );

    const submitAction = useAsyncAction(
        async (planData) => {
            const plan = await createServicePlan(contractorId, {
                ...planData,
                price: parseFloat(planData.price)
            });
            return plan;
        },
        {
            successMessage: 'Service plan created!',
            onSuccess: (plan) => {
                form.reset();
                onSuccess(plan);
            }
        }
    );

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (form.validate()) {
            await submitAction.execute(form.values);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div>
                <label className="block text-sm font-medium text-slate-700">
                    Plan Name
                </label>
                <input
                    name="name"
                    value={form.values.name}
                    onChange={form.handleChange}
                    onBlur={form.handleBlur}
                    placeholder="e.g., Annual Maintenance Plan"
                    className="w-full px-3 py-2 border rounded-lg"
                />
                {form.touched.name && form.errors.name && (
                    <p className="text-red-500 text-sm mt-1">{form.errors.name}</p>
                )}
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-slate-700">
                        Price
                    </label>
                    <input
                        name="price"
                        type="number"
                        min="0"
                        step="0.01"
                        value={form.values.price}
                        onChange={form.handleChange}
                        onBlur={form.handleBlur}
                        placeholder="99.00"
                        className="w-full px-3 py-2 border rounded-lg"
                    />
                    {form.touched.price && form.errors.price && (
                        <p className="text-red-500 text-sm mt-1">{form.errors.price}</p>
                    )}
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-700">
                        Billing Interval
                    </label>
                    <select
                        name="interval"
                        value={form.values.interval}
                        onChange={form.handleChange}
                        className="w-full px-3 py-2 border rounded-lg"
                    >
                        <option value="monthly">Monthly</option>
                        <option value="quarterly">Quarterly</option>
                        <option value="yearly">Yearly</option>
                    </select>
                </div>
            </div>

            <div>
                <label className="block text-sm font-medium text-slate-700">
                    Description
                </label>
                <textarea
                    name="description"
                    value={form.values.description}
                    onChange={form.handleChange}
                    rows={3}
                    placeholder="What's included in this plan..."
                    className="w-full px-3 py-2 border rounded-lg"
                />
            </div>

            <div className="flex gap-3 justify-end pt-4 border-t">
                <button
                    type="button"
                    onClick={onCancel}
                    className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                    Cancel
                </button>
                <button
                    type="submit"
                    disabled={submitAction.loading}
                    className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-2"
                >
                    {submitAction.loading ? (
                        <>
                            <ButtonLoader size={16} />
                            Creating...
                        </>
                    ) : (
                        'Create Plan'
                    )}
                </button>
            </div>
        </form>
    );
};
```

---

## Quick Reference

```jsx
// Import all hooks from barrel export
import {
    useModal,
    useAsyncAction,
    useConfirmAction,
    useFormState
} from '@/hooks';

// Import ConfirmDialog component
import { ConfirmDialog } from '@/components/common';
```

| Hook | Primary Use Case |
|------|-----------------|
| `useModal` | Managing modal/dialog open state |
| `useAsyncAction` | Wrapping async operations with loading/error |
| `useConfirmAction` | Adding confirmation step to destructive actions |
| `useFormState` | Managing form values, validation, and touched state |
