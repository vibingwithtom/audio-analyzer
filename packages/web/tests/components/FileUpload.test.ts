import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import FileUpload from '../../src/components/FileUpload.svelte';

describe('FileUpload', () => {
  it('should render file input', () => {
    const { getByLabelText } = render(FileUpload, { props: { id: 'test-upload' } });
    const input = getByLabelText(/upload/i);
    expect(input).toBeTruthy();
    expect(input.getAttribute('type')).toBe('file');
  });

  it('should call onChange callback when file selected', async () => {
    const onChange = vi.fn();
    const { getByLabelText } = render(FileUpload, {
      props: {
        id: 'test-upload',
        onChange
      }
    });
    const input = getByLabelText(/upload/i);

    const file = new File(['test'], 'test.wav', { type: 'audio/wav' });

    await fireEvent.change(input, { target: { files: [file] } });

    expect(onChange).toHaveBeenCalled();
    const event = onChange.mock.calls[0][0];
    expect(event.target).toBe(input);
  });

  it('should show processing state', () => {
    const { getByText } = render(FileUpload, { props: { id: 'test-upload', processing: true } });
    expect(getByText(/processing/i)).toBeTruthy();
  });
});
