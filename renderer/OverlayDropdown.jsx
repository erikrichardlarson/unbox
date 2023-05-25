import React from 'react'
import { Listbox, Transition } from '@headlessui/react'
import { CheckIcon, SelectorIcon } from '@heroicons/react/solid'

function classNames(...classes) {
  return classes.filter(Boolean).join(' ')
}

const OverlayDropdown = ({ options, onChange, selectedOption }) => {
  return (
      <Listbox value={selectedOption} onChange={onChange}>
        {({ open }) => (
            <>
              <div className="mt-1 relative mb-12">
                <Listbox.Button className="relative w-full py-2 pl-3 pr-10 text-left bg-white rounded-lg border border-gray-300 shadow-sm cursor-default focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm">
                  <span className="block truncate">{selectedOption.name}</span>
                  <span className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                <SelectorIcon className="h-5 w-5 text-gray-400" aria-hidden="true" />
              </span>
                </Listbox.Button>
                <Transition
                    show={open}
                    as="div"
                    leave="transition ease-in duration-100"
                    leaveFrom="opacity-100"
                    leaveTo="opacity-0"
                    className="absolute mt-1 w-full rounded-md bg-white shadow-lg z-20"
                >
                  <Listbox.Options static className="py-1 max-h-60 rounded-md text-base ring-1 ring-black ring-opacity-5 overflow-auto focus:outline-none sm:text-sm">
                    {options.map((option) => (
                        <Listbox.Option
                            key={option.id}
                            className={({ active }) =>
                                classNames(
                                    active ? 'text-white bg-indigo-600' : 'text-gray-900',
                                    'cursor-default select-none relative py-2 pl-8 pr-4'
                                )
                            }
                            value={option}
                        >
                          {({ selected, active }) => (
                              <>
                        <span className={classNames(selected ? 'font-semibold' : 'font-normal', 'block truncate')}>
                          {option.name}
                        </span>

                                {selected ? (
                                    <span className={classNames(active ? 'text-white' : 'text-indigo-600', 'absolute inset-y-0 left-0 flex items-center pl-3')}>
                            <CheckIcon className="h-5 w-5" aria-hidden="true" />
                          </span>
                                ) : null}
                              </>
                          )}
                        </Listbox.Option>
                    ))}
                  </Listbox.Options>
                </Transition>
              </div>
            </>
        )}
      </Listbox>
  )
}

export default OverlayDropdown;