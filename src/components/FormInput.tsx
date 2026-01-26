interface FormInputProps {
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  type?: string;
}

const FormInput = ({ label, value, onChange, type = 'text' }: FormInputProps) => (
  <div className="form-group">
    <label>{label}</label>
    <input type={type} value={value} onChange={onChange} />
  </div>
);

export default FormInput;